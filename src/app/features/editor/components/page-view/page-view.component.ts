import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  createFromDrag,
  createNote,
  createSymbol,
  createText,
  createTextEdit,
  isDragTool,
  withDefaultSize,
} from '@core/annotations';
import { MAX_CANVAS_PIXELS, MAX_DEVICE_PIXEL_RATIO } from '@core/constants';
import { FontMetricsService, guessFontStyle } from '@core/fonts';
import {
  type Annotation,
  type NoteAnnotation,
  type PageRef,
  type PathAnnotation,
  type Point,
  type Size,
  type TextAnnotation,
  type TextLine,
} from '@core/models';
import { PageRenderService, isRenderCancelled } from '@core/pdf';
import { DocumentActionsService, LoggerService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import {
  absolutePoints,
  clamp,
  createId,
  displaySize,
  isImageFile,
  normalizePoints,
  resizeRect,
  screenToPage,
  trackPointer,
} from '@core/utils';
import { InViewportDirective } from '@shared/directives';
import { EditorCommandsService } from '../../services/editor-commands.service';
import { sampleTextColors } from '../../services/text-color-sampler';
import { AnnotationViewComponent } from './annotation-view/annotation-view.component';
import { FormFieldLayerComponent } from './form-field-layer/form-field-layer.component';
import { NotePopoverComponent } from './note-popover/note-popover.component';
import { PageDecorationsComponent } from './page-decorations/page-decorations.component';
import {
  SelectionOverlayComponent,
  type HandleDragStart,
} from './selection-overlay/selection-overlay.component';
import {
  TextAnnotationComponent,
  type TextInput,
} from './text-annotation/text-annotation.component';
import { TextLineLayerComponent } from './text-line-layer/text-line-layer.component';

/** Espera antes de redibujar tras un cambio de zoom (evita renders intermedios). */
const ZOOM_RENDER_DEBOUNCE_MS = 140;
/** Tipos que se redimensionan manteniendo la proporción. */
const KEEP_RATIO_TYPES = new Set<Annotation['type']>(['image', 'symbol', 'stamp', 'text']);

/**
 * Una página del visor: dibuja el PDF y las capas interactivas encima
 * (formularios, texto editable, anotaciones, selección y resultados de búsqueda).
 *
 * Todas las coordenadas internas están en el espacio base de la página (puntos PDF);
 * la rotación del usuario se aplica con CSS y `toPagePoint()` deshace esa rotación.
 */
@Component({
  selector: 'app-page-view',
  imports: [
    AnnotationViewComponent,
    TextAnnotationComponent,
    SelectionOverlayComponent,
    NotePopoverComponent,
    FormFieldLayerComponent,
    TextLineLayerComponent,
    PageDecorationsComponent,
  ],
  templateUrl: './page-view.component.html',
  styleUrl: './page-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: InViewportDirective, inputs: ['appInViewportMargin'] }],
  host: {
    '[class.is-current]': 'isCurrent()',
    '[attr.data-page-index]': 'index()',
  },
})
export class PageViewComponent {
  readonly page = input.required<PageRef>();
  readonly index = input.required<number>();
  readonly zoom = input.required<number>();

  protected readonly documentStore = inject(DocumentStore);
  protected readonly editorStore = inject(EditorStore);
  private readonly renderer = inject(PageRenderService);
  private readonly metrics = inject(FontMetricsService);
  private readonly commands = inject(EditorCommandsService);
  private readonly actions = inject(DocumentActionsService);
  private readonly logger = inject(LoggerService);
  protected readonly viewport = inject(InViewportDirective);

  private readonly sheet = viewChild.required<ElementRef<HTMLDivElement>>('sheet');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly rendered = signal(false);
  /** Anotación que se está dibujando con el ratón (todavía no está en el documento). */
  protected readonly draft = signal<Exclude<Annotation, TextAnnotation> | null>(null);
  private renderedScale = 0;

  // --- Derivados -----------------------------------------------------------------

  protected readonly isCurrent = computed(
    () => this.editorStore.currentPageIndex() === this.index(),
  );
  protected readonly displaySize = computed(() => displaySize(this.page()));
  protected readonly pageTransform = computed(
    () => `translate(-50%, -50%) rotate(${this.page().rotation}deg)`,
  );
  protected readonly tool = this.editorStore.tool;
  protected readonly isInteractive = computed(
    () => this.tool() === 'select' || this.tool() === 'edit-text',
  );
  protected readonly cursor = computed(() => {
    const tool = this.tool();
    if (tool === 'select' || tool === 'edit-text') return 'default';
    return tool === 'text' ? 'text' : 'crosshair';
  });

  protected readonly annotations = computed(
    () => this.documentStore.annotationsByPage().get(this.page().id) ?? [],
  );
  protected readonly textAnnotations = computed(() =>
    this.annotations().filter((a): a is TextAnnotation => a.type === 'text'),
  );
  protected readonly covers = computed(() => this.textAnnotations().filter((a) => !!a.cover));
  protected readonly editedLineKeys = computed(
    () => new Set(this.textAnnotations().flatMap((a) => (a.editOf ? [a.editOf] : []))),
  );

  protected readonly selected = computed(() => {
    const selected = this.editorStore.selectedAnnotation();
    return selected?.pageId === this.page().id ? selected : null;
  });
  protected readonly showSelection = computed(
    () =>
      !!this.selected() &&
      this.tool() === 'select' &&
      this.editorStore.editingAnnotationId() !== this.selected()?.id,
  );
  protected readonly editingNote = computed(() => {
    const id = this.editorStore.editingAnnotationId();
    return (
      (this.annotations().find((a) => a.id === id && a.type === 'note') as
        NoteAnnotation | undefined) ?? null
    );
  });

  protected readonly searchHits = computed(() => {
    const active = this.editorStore.activeHitIndex();
    return this.editorStore
      .searchHits()
      .map((hit, i) => ({ ...hit, active: i === active }))
      .filter((hit) => hit.pageId === this.page().id);
  });

  constructor() {
    // Dibujar el lienzo cuando la página está a la vista; liberarlo cuando sale.
    effect((onCleanup) => {
      const visible = this.viewport.isVisible();
      const page = this.page();
      const zoom = this.zoom();
      if (!visible) {
        untracked(() => this.releaseCanvas());
        return;
      }
      const controller = new AbortController();
      const delay = untracked(() => this.rendered()) ? ZOOM_RENDER_DEBOUNCE_MS : 0;
      const timer = setTimeout(() => void this.renderCanvas(page, zoom, controller.signal), delay);
      onCleanup(() => {
        clearTimeout(timer);
        controller.abort();
      });
    });
  }

  // --- Lienzo ----------------------------------------------------------------------

  private async renderCanvas(page: PageRef, zoom: number, signal: AbortSignal): Promise<void> {
    let scale = zoom * Math.min(devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    if (page.width * page.height * scale * scale > MAX_CANVAS_PIXELS) {
      scale = Math.sqrt(MAX_CANVAS_PIXELS / (page.width * page.height));
    }
    if (this.rendered() && Math.abs(scale - this.renderedScale) < 0.001) return;
    try {
      await this.renderer.renderInto(this.canvas().nativeElement, page, {
        scale,
        hideFormFields: true,
        signal,
      });
      if (signal.aborted) return;
      this.renderedScale = scale;
      this.rendered.set(true);
    } catch (error) {
      if (!isRenderCancelled(error)) this.logger.error('No se pudo dibujar la página', error);
    }
  }

  private releaseCanvas(): void {
    if (!this.rendered()) return;
    const canvas = this.canvas().nativeElement;
    canvas.width = 0;
    canvas.height = 0;
    this.rendered.set(false);
    this.renderedScale = 0;
  }

  // --- Coordenadas -----------------------------------------------------------------

  private toPagePoint(event: { clientX: number; clientY: number }): Point {
    const rect = this.sheet().nativeElement.getBoundingClientRect();
    const page = this.page();
    return screenToPage(
      { x: event.clientX, y: event.clientY },
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      this.zoom(),
      page.rotation,
      { w: page.width, h: page.height },
    );
  }

  // --- Interacción con la página ---------------------------------------------------

  protected onPagePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.editorStore.currentPageIndex.set(this.index());
    this.finishEditing();

    const tool = this.tool();
    if (tool === 'select' || tool === 'edit-text') {
      this.editorStore.selectAnnotation(null);
      return;
    }
    event.preventDefault();
    const point = this.toPagePoint(event);
    const page = this.page();
    const style = this.editorStore.toolStyle();

    switch (tool) {
      case 'text': {
        // Evita que el navegador mueva el foco tras el clic y se lo quite al nuevo campo de texto
        event.preventDefault();
        const text = createText(page.id, point, style);
        this.documentStore.beginTransaction();
        this.documentStore.addAnnotation(text);
        this.editorStore.setTool('select');
        this.editorStore.startEditing(text.id);
        return;
      }
      case 'note': {
        event.preventDefault();
        const note = createNote(page.id, point, style.noteColor);
        this.documentStore.addAnnotation(note);
        this.editorStore.setTool('select');
        this.editorStore.startEditing(note.id);
        return;
      }
      case 'symbol':
        this.documentStore.addAnnotation(createSymbol(page.id, point, style));
        return;
      default:
        if (isDragTool(tool)) this.drawWithTool(tool, event, point);
    }
  }

  private drawWithTool(
    tool: Parameters<typeof createFromDrag>[0],
    event: PointerEvent,
    start: Point,
  ): void {
    const id = createId('an');
    const pageId = this.page().id;
    const points: Point[] = [start];
    const build = (constrain: boolean) =>
      createFromDrag(tool, id, pageId, points, this.editorStore.toolStyle(), constrain) as Exclude<
        Annotation,
        TextAnnotation
      >;
    this.draft.set(build(false));

    trackPointer(event, {
      threshold: 2,
      onMove: (move) => {
        const point = this.toPagePoint(move);
        if (tool === 'ink') points.push(point);
        else points[1] = point;
        this.draft.set(build(move.shiftKey));
      },
      onEnd: (_end, dragged) => {
        const draft = this.draft();
        this.draft.set(null);
        if (!draft) return;
        // Un clic sin arrastrar no crea resaltados ni trazos; las formas toman un tamaño por defecto
        if (!dragged && (tool === 'highlight' || tool === 'ink')) return;
        const annotation = dragged ? draft : withDefaultSize(draft, start);
        this.documentStore.addAnnotation(annotation);
        // Resaltar, dibujar y tapar siguen activas para encadenar varias marcas
        if (tool !== 'ink' && tool !== 'highlight' && tool !== 'whiteout') {
          this.editorStore.setTool('select');
          this.editorStore.selectAnnotation(annotation.id);
        }
      },
    });
  }

  // --- Mover y redimensionar ----------------------------------------------------------

  protected onAnnotationPointerDown(event: PointerEvent, annotation: Annotation): void {
    if (event.button !== 0) return;
    const tool = this.tool();
    const canInteract = tool === 'select' || (tool === 'edit-text' && annotation.type === 'text');
    if (!canInteract || this.editorStore.editingAnnotationId() === annotation.id) return;
    event.stopPropagation();
    event.preventDefault();

    this.editorStore.currentPageIndex.set(this.index());
    const wasSelected = this.editorStore.selectedAnnotationId() === annotation.id;
    this.finishEditing();
    this.editorStore.selectAnnotation(annotation.id);

    const start = this.toPagePoint(event);
    this.documentStore.beginTransaction();
    trackPointer(event, {
      onMove: (move) => {
        const point = this.toPagePoint(move);
        this.documentStore.updateAnnotation(annotation.id, {
          x: annotation.x + point.x - start.x,
          y: annotation.y + point.y - start.y,
        });
      },
      onEnd: (_end, dragged) => {
        this.documentStore.endTransaction();
        // Un clic sobre un texto ya seleccionado (o en modo "editar texto") empieza a editarlo
        const editable = annotation.type === 'text' || annotation.type === 'note';
        if (
          !dragged &&
          editable &&
          (wasSelected || tool === 'edit-text' || annotation.type === 'note')
        ) {
          this.editorStore.startEditing(annotation.id);
        }
      },
    });
  }

  protected onAnnotationDoubleClick(event: MouseEvent, annotation: Annotation): void {
    if (annotation.type !== 'text' && annotation.type !== 'note') return;
    event.stopPropagation();
    this.editorStore.startEditing(annotation.id);
  }

  protected onHandleDragStart({ handle, event }: HandleDragStart): void {
    const original = this.selected();
    if (!original) return;
    const start = this.toPagePoint(event);
    const endpoints =
      original.type === 'line' || original.type === 'arrow' ? absolutePoints(original) : null;

    this.documentStore.beginTransaction();
    trackPointer(event, {
      threshold: 0,
      onMove: (move) => {
        const point = this.toPagePoint(move);
        const delta = { x: point.x - start.x, y: point.y - start.y };
        if (endpoints && (handle === 'start' || handle === 'end')) {
          const moved = endpoints.map((p, i) =>
            (handle === 'start' ? 0 : 1) === i ? { x: p.x + delta.x, y: p.y + delta.y } : p,
          );
          this.documentStore.updateAnnotation(
            original.id,
            normalizePoints(moved) as Partial<PathAnnotation>,
          );
          return;
        }
        if (handle === 'start' || handle === 'end') return;
        const keepRatio = KEEP_RATIO_TYPES.has(original.type) !== move.shiftKey;
        const box = resizeRect(original, handle, delta, keepRatio);
        if (original.type === 'text') {
          // Redimensionar un texto cambia su tamaño de letra
          const size = clamp(Math.round(original.size * (box.w / original.w) * 10) / 10, 4, 400);
          this.documentStore.updateAnnotation(original.id, { x: box.x, y: box.y, size });
        } else {
          this.documentStore.updateAnnotation(original.id, box);
        }
      },
      onEnd: () => this.documentStore.endTransaction(),
    });
  }

  // --- Edición de texto -------------------------------------------------------------

  protected onLineSelected(line: TextLine): void {
    const font = guessFontStyle(line.fontRealName || line.fontName, line.fontFamily);
    const size = Math.round(line.fontSize * 10) / 10;
    const colors = sampleTextColors(
      this.canvas().nativeElement,
      { x: line.x, y: line.y, w: line.width, h: line.height },
      this.page().width,
    );
    const offset = this.metrics.baselineOffset(font.font, font.bold, font.italic, size);
    const edit = createTextEdit(this.page().id, { ...line, fontSize: size }, font, colors, offset);
    this.finishEditing();
    this.documentStore.beginTransaction();
    this.documentStore.addAnnotation(edit);
    this.editorStore.startEditing(edit.id);
  }

  protected onTextInput(annotation: TextAnnotation, input: TextInput): void {
    this.documentStore.updateAnnotation(
      annotation.id,
      { text: input.text, w: input.size.w, h: input.size.h },
      `text:${annotation.id}`,
    );
  }

  protected onTextEditEnd(annotation: TextAnnotation, text: string): void {
    if (text !== annotation.text)
      this.documentStore.updateAnnotation(annotation.id, { text }, `text:${annotation.id}`);
    if (this.editorStore.editingAnnotationId() === annotation.id) this.editorStore.stopEditing();
    // Un texto nuevo que se deja vacío se descarta (una edición vacía sí sirve: borra el original)
    if (!text.trim() && !annotation.cover) this.documentStore.removeAnnotation(annotation.id);
    this.documentStore.endTransaction();
  }

  protected onTextSizeChange(annotation: TextAnnotation, size: Size): void {
    this.documentStore.syncAnnotationSizes(new Map([[annotation.id, { w: size.w, h: size.h }]]));
  }

  private finishEditing(): void {
    if (!this.editorStore.editingAnnotationId()) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.isContentEditable) active.blur();
    this.editorStore.stopEditing();
  }

  // --- Comentarios y acciones de la selección ---------------------------------------

  protected onNoteText(note: NoteAnnotation, text: string): void {
    this.documentStore.updateAnnotation(note.id, { text }, `note:${note.id}`);
  }

  protected closeNote(): void {
    this.editorStore.stopEditing();
  }

  protected removeAnnotation(id: string): void {
    this.documentStore.removeAnnotation(id);
  }

  protected duplicateSelected(): void {
    this.commands.duplicateSelected();
  }

  protected editSelected(): void {
    const selected = this.selected();
    if (selected) this.editorStore.startEditing(selected.id);
  }

  // --- Soltar archivos sobre la página ------------------------------------------------

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }

  /** Las imágenes se colocan donde se sueltan; los PDF se insertan después de esta página. */
  protected async onDrop(event: DragEvent): Promise<void> {
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    const point = this.toPagePoint(event);
    for (const image of files.filter(isImageFile))
      await this.commands.insertImageFile(image, this.page(), point);
    const documents = files.filter((f) => !isImageFile(f));
    if (documents.length) await this.actions.insertFiles(documents, this.index() + 1);
  }
}
