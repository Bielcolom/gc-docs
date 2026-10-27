import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { MAX_INITIAL_ZOOM, PAGE_PRELOAD_MARGIN } from '@core/constants';
import { DocumentActionsService } from '@core/services';
import { DocumentStore, EditorStore, type FitMode } from '@core/state';
import { displaySize } from '@core/utils';
import { PageViewComponent } from '../page-view/page-view.component';

const PAGE_SELECTOR = 'app-page-view';
/** Proporción de la altura visible que marca qué página es la actual. */
const CURRENT_PAGE_LINE = 0.35;
const SCROLL_TOP_OFFSET = 20;
const WHEEL_ZOOM_SPEED = 0.0022;

/**
 * Lista desplazable de páginas. Gestiona el zoom (ajustar, rueda + Ctrl), la página actual
 * y los desplazamientos que piden otros componentes a través de `EditorStore`.
 */
@Component({
  selector: 'app-document-viewer',
  imports: [PageViewComponent],
  templateUrl: './document-viewer.component.html',
  styleUrl: './document-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentViewerComponent {
  protected readonly documentStore = inject(DocumentStore);
  protected readonly editorStore = inject(EditorStore);
  private readonly actions = inject(DocumentActionsService);
  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');

  protected readonly preloadMargin = PAGE_PRELOAD_MARGIN;
  private scrollFrame = 0;

  constructor() {
    // Desplazamientos pedidos desde fuera (miniaturas, búsqueda, atajos…)
    effect(() => {
      const request = this.editorStore.scrollRequest();
      if (request)
        untracked(() => setTimeout(() => this.scrollToPage(request.pageIndex, request.y)));
    });

    effect(() => {
      const request = this.editorStore.fitRequest();
      if (request) untracked(() => this.fit(request.mode, false));
    });

    // Al abrir un documento, ajustar al ancho (una sola vez)
    effect(() => {
      if (this.documentStore.hasDocument() && !this.editorStore.initialFitDone()) {
        untracked(() =>
          setTimeout(() => {
            this.fit('width', true);
            this.editorStore.initialFitDone.set(true);
          }),
        );
      }
    });

    // Al cambiar el zoom, mantener a la vista la misma zona del documento
    let previousZoom = this.editorStore.zoom();
    effect(() => {
      const zoom = this.editorStore.zoom();
      untracked(() => {
        const ratio = zoom / previousZoom;
        previousZoom = zoom;
        if (ratio === 1) return;
        const el = this.scroller().nativeElement;
        const centerY = el.scrollTop + el.clientHeight / 2;
        const centerX = el.scrollLeft + el.clientWidth / 2;
        requestAnimationFrame(() => {
          el.scrollTop = centerY * ratio - el.clientHeight / 2;
          el.scrollLeft = centerX * ratio - el.clientWidth / 2;
        });
      });
    });
  }

  private fit(mode: FitMode, onlyShrink: boolean): void {
    const el = this.scroller().nativeElement;
    const page = this.editorStore.currentPage();
    if (!page) return;
    const { w, h } = displaySize(page);
    const narrow = el.clientWidth < 700;
    const availableWidth = el.clientWidth - (narrow ? 20 : 56);
    const availableHeight = el.clientHeight - 80;
    let zoom =
      mode === 'width' ? availableWidth / w : Math.min(availableWidth / w, availableHeight / h);
    if (onlyShrink) zoom = Math.min(zoom, MAX_INITIAL_ZOOM);
    this.editorStore.setZoom(zoom);
    // Si hay páginas más anchas (apaisadas), centrar el desplazamiento horizontal
    setTimeout(
      () =>
        requestAnimationFrame(
          () => (el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)),
        ),
      30,
    );
  }

  private scrollToPage(index: number, y?: number): void {
    const el = this.scroller().nativeElement;
    const page = el.querySelectorAll<HTMLElement>(PAGE_SELECTOR)[index];
    if (!page) return;
    const offset = y === undefined ? 0 : y * this.editorStore.zoom() - el.clientHeight / 3;
    el.scrollTo({
      top: Math.max(0, page.offsetTop - SCROLL_TOP_OFFSET + offset),
      behavior: y === undefined ? 'auto' : 'smooth',
    });
  }

  protected onScroll(): void {
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      const el = this.scroller().nativeElement;
      const line = el.scrollTop + el.clientHeight * CURRENT_PAGE_LINE;
      const pages = el.querySelectorAll<HTMLElement>(PAGE_SELECTOR);
      let current = 0;
      for (let i = 0; i < pages.length && pages[i].offsetTop <= line; i++) current = i;
      if (current !== this.editorStore.currentPageIndex())
        this.editorStore.currentPageIndex.set(current);
    });
  }

  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.editorStore.setZoom(this.editorStore.zoom() * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED));
  }

  /** Un clic en el fondo (fuera de las páginas) quita la selección. */
  protected onBackgroundPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest(PAGE_SELECTOR)) return;
    this.editorStore.selectAnnotation(null);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.isContentEditable) active.blur();
    this.editorStore.stopEditing();
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!files.length) return;
    event.preventDefault();
    await this.actions.insertFiles(files);
  }
}
