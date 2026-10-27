import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterEveryRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DocumentStore } from '../core/document.store';
import { FONT_MAP, baselineOffset, guessFont, LINE_HEIGHT } from '../core/fonts';
import { Annot, PageRef, PathAnnot, TextAnnot } from '../core/models';
import { AnnotationMode, PDFPageProxy } from '../core/pdfjs';
import { TextLine, getTextLines } from '../core/text-extract';
import { clamp, normalizeImage, rgbToHex, uid } from '../core/util';
import { absolutePoints, measureText, normalizePoints, placeImage } from '../core/actions';
import { SYMBOL_PATHS, arrowHead, pageNumberText, roundedRectPath, smoothPath } from '../core/exporter';
import { Icon } from './icon';
import { UiService } from './ui.service';

interface FormField {
  id: string;
  name: string;
  kind: 'text' | 'checkbox' | 'radio' | 'select';
  x: number;
  y: number;
  w: number;
  h: number;
  multiline: boolean;
  readOnly: boolean;
  initial: string | boolean;
  exportValue: string;
  options: { value: string; label: string }[];
  fontSize: number;
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'p0' | 'p1';

const DRAG_TOOLS = new Set(['rect', 'ellipse', 'line', 'arrow', 'highlight', 'whiteout', 'ink']);

@Component({
  selector: 'app-page-view',
  imports: [Icon, NgTemplateOutlet],
  templateUrl: './page-view.html',
  styleUrl: './page-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.current]': 'store.currentPage() === index()',
    '[attr.data-index]': 'index()',
  },
})
export class PageView {
  readonly page = input.required<PageRef>();
  readonly index = input.required<number>();
  readonly zoom = input.required<number>();

  protected readonly store = inject(DocumentStore);
  protected readonly ui = inject(UiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly wrapRef = viewChild<ElementRef<HTMLDivElement>>('wrap');
  private readonly innerRef = viewChild<ElementRef<HTMLDivElement>>('inner');
  private readonly editRef = viewChild<ElementRef<HTMLDivElement>>('editEl');
  private readonly noteRef = viewChild<ElementRef<HTMLTextAreaElement>>('noteArea');

  protected readonly visible = signal(false);
  protected readonly rendered = signal(false);
  protected readonly lines = signal<TextLine[]>([]);
  protected readonly fields = signal<FormField[]>([]);
  protected readonly draft = signal<Annot | null>(null);
  protected readonly hoverLine = signal<string | null>(null);

  private renderTask: { cancel(): void } | null = null;
  private renderSeq = 0;
  private renderedScale = 0;
  private pdfPage: PDFPageProxy | null = null;
  private fieldsLoaded = false;

  protected readonly Math = Math;
  protected readonly FONT_MAP = FONT_MAP;
  protected readonly LINE_HEIGHT = LINE_HEIGHT;
  protected readonly SYMBOL_PATHS = SYMBOL_PATHS;

  protected readonly dispW = computed(() => (this.page().rotation % 180 ? this.page().h : this.page().w));
  protected readonly dispH = computed(() => (this.page().rotation % 180 ? this.page().w : this.page().h));
  protected readonly annots = computed(() => this.store.annotsByPage().get(this.page().id) ?? []);
  protected readonly covers = computed(() => this.annots().filter((a): a is TextAnnot => a.type === 'text' && !!a.cover));
  protected readonly editedKeys = computed(() => {
    const s = new Set<string>();
    for (const a of this.annots()) if (a.type === 'text' && a.editOf) s.add(a.editOf);
    return s;
  });
  protected readonly hits = computed(() => {
    const all = this.store.searchHits();
    const active = this.store.activeHit();
    const id = this.page().id;
    return all.map((h, i) => ({ ...h, active: i === active })).filter((h) => h.pageId === id);
  });
  protected readonly interactive = computed(() => {
    const t = this.store.tool();
    return t === 'select' || t === 'editText';
  });
  protected readonly cursor = computed(() => {
    const t = this.store.tool();
    if (t === 'select') return 'default';
    if (t === 'editText') return 'default';
    if (t === 'text') return 'text';
    return 'crosshair';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) this.visible.set(e.isIntersecting);
      },
      { root: null, rootMargin: '900px 0px' },
    );
    queueMicrotask(() => io.observe(this.host.nativeElement));
    destroyRef.onDestroy(() => {
      io.disconnect();
      this.renderTask?.cancel();
    });

    // Renderizado del lienzo
    effect((onCleanup) => {
      const vis = this.visible();
      const page = this.page();
      const z = this.zoom();
      if (!vis) {
        untracked(() => this.unload());
        return;
      }
      const delay = untracked(() => this.rendered()) ? 140 : 0;
      const t = setTimeout(() => this.render(page, z), delay);
      onCleanup(() => clearTimeout(t));
    });

    // Líneas de texto para el modo "Editar texto"
    effect(() => {
      const tool = this.store.tool();
      const vis = this.visible();
      const page = this.page();
      if (!vis || tool !== 'editText') return;
      untracked(() => {
        this.store.getPdfPage(page.srcId, page.srcIndex).then((p) => getTextLines(p, page.vt)).then((l) => this.lines.set(l));
      });
    });

    // Campos de formulario
    effect(() => {
      if (!this.visible() || this.fieldsLoaded) return;
      this.fieldsLoaded = true;
      untracked(() => this.loadFields());
    });

    // Al empezar a editar un texto, rellenar y enfocar el elemento editable
    effect(() => {
      const el = this.editRef()?.nativeElement;
      if (!el || el.dataset['init']) return;
      const a = untracked(() => this.store.annots().find((x) => x.id === this.store.editingId()));
      if (!a || a.type !== 'text') return;
      el.dataset['init'] = '1';
      this.store.begin();
      el.innerText = a.text;
      el.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(el);
      if (a.text === 'Escribe aquí') {
        /* seleccionar todo el texto de ejemplo */
      } else range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });

    // Enfocar el comentario al abrirlo
    effect(() => {
      const el = this.noteRef()?.nativeElement;
      if (el) setTimeout(() => el.focus({ preventScroll: true }), 0);
    });

    afterEveryRender({ read: () => this.syncTextSizes() });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private unload(): void {
    this.renderTask?.cancel();
    this.renderTask = null;
    const c = this.canvasRef()?.nativeElement;
    if (c && this.rendered()) {
      c.width = 0;
      c.height = 0;
      this.rendered.set(false);
      this.renderedScale = 0;
    }
  }

  private async render(ref: PageRef, z: number): Promise<void> {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let scale = z * dpr;
    const maxPixels = 14_000_000;
    if (ref.w * ref.h * scale * scale > maxPixels) scale = Math.sqrt(maxPixels / (ref.w * ref.h));
    if (this.rendered() && Math.abs(scale - this.renderedScale) < 0.001) return;
    const seq = ++this.renderSeq;
    try {
      const page = await this.store.getPdfPage(ref.srcId, ref.srcIndex);
      this.pdfPage = page;
      if (seq !== this.renderSeq) return;
      const vp = page.getViewport({ scale });
      const off = document.createElement('canvas');
      off.width = Math.ceil(vp.width);
      off.height = Math.ceil(vp.height);
      this.renderTask?.cancel();
      const task = page.render({
        canvas: off,
        viewport: vp,
        annotationMode: AnnotationMode.ENABLE_FORMS,
        background: '#ffffff',
      });
      this.renderTask = task;
      await task.promise;
      if (seq !== this.renderSeq) return;
      canvas.width = off.width;
      canvas.height = off.height;
      canvas.getContext('2d')!.drawImage(off, 0, 0);
      off.width = 0;
      this.renderedScale = scale;
      this.rendered.set(true);
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.error(e);
    }
  }

  private async loadFields(): Promise<void> {
    const ref = this.page();
    try {
      const page = await this.store.getPdfPage(ref.srcId, ref.srcIndex);
      const anns: any[] = await page.getAnnotations({ intent: 'display' });
      const vt = ref.vt;
      const out: FormField[] = [];
      for (const a of anns) {
        if (a.subtype !== 'Widget' || !a.fieldName || a.hidden) continue;
        const [x1, y1, x2, y2] = a.rect;
        const p1 = [vt[0] * x1 + vt[2] * y1 + vt[4], vt[1] * x1 + vt[3] * y1 + vt[5]];
        const p2 = [vt[0] * x2 + vt[2] * y2 + vt[4], vt[1] * x2 + vt[3] * y2 + vt[5]];
        const x = Math.min(p1[0], p2[0]);
        const y = Math.min(p1[1], p2[1]);
        const w = Math.abs(p2[0] - p1[0]);
        const h = Math.abs(p2[1] - p1[1]);
        let kind: FormField['kind'] | null = null;
        if (a.fieldType === 'Tx') kind = 'text';
        else if (a.fieldType === 'Btn' && a.checkBox) kind = 'checkbox';
        else if (a.fieldType === 'Btn' && a.radioButton) kind = 'radio';
        else if (a.fieldType === 'Ch') kind = 'select';
        if (!kind) continue;
        let initial: string | boolean = '';
        if (kind === 'checkbox') initial = !!a.fieldValue && a.fieldValue !== 'Off';
        else if (kind === 'radio') initial = a.fieldValue && a.fieldValue !== 'Off' ? String(a.fieldValue) : '';
        else initial = Array.isArray(a.fieldValue) ? String(a.fieldValue[0] ?? '') : String(a.fieldValue ?? '');
        out.push({
          id: a.id,
          name: a.fieldName,
          kind,
          x,
          y,
          w,
          h,
          multiline: !!a.multiLine,
          readOnly: !!a.readOnly,
          initial,
          exportValue: String(a.exportValue ?? a.buttonValue ?? 'Yes'),
          options: (a.options ?? []).map((o: any) => ({ value: String(o.exportValue ?? o.displayValue), label: String(o.displayValue ?? o.exportValue) })),
          fontSize: a.textFontSize || 0,
        });
      }
      this.fields.set(out);
    } catch (e) {
      console.warn('No se pudieron leer los campos del formulario', e);
    }
  }

  protected fieldValue(f: FormField): string | boolean {
    const v = this.store.state().forms[`${this.page().srcId}::${f.name}`];
    return v === undefined ? f.initial : v;
  }

  protected setField(f: FormField, value: string | boolean): void {
    this.store.setFormValue(this.page().srcId, f.name, value);
  }

  protected radioChecked(f: FormField): boolean {
    return this.fieldValue(f) === f.exportValue;
  }

  protected inputValue(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected inputChecked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }

  // ---------------------------------------------------------------------------
  // Coordenadas
  // ---------------------------------------------------------------------------

  private toBase(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const wrap = this.wrapRef()!.nativeElement.getBoundingClientRect();
    const p = this.page();
    const z = this.zoom();
    const dx = (e.clientX - (wrap.left + wrap.width / 2)) / z;
    const dy = (e.clientY - (wrap.top + wrap.height / 2)) / z;
    const t = (-p.rotation * Math.PI) / 180;
    const rx = dx * Math.cos(t) - dy * Math.sin(t);
    const ry = dx * Math.sin(t) + dy * Math.cos(t);
    return { x: rx + p.w / 2, y: ry + p.h / 2 };
  }

  private drag(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void): void {
    const move = (e: PointerEvent) => {
      e.preventDefault();
      onMove(e);
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      onUp(e);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // ---------------------------------------------------------------------------
  // Interacción con la capa
  // ---------------------------------------------------------------------------

  protected onLayerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.store.currentPage.set(this.index());
    const tool = this.store.tool();
    const st = this.store.style();
    const pt = this.toBase(e);
    const page = this.page();
    this.finishEditing();

    if (tool === 'select' || tool === 'editText') {
      this.store.selectedId.set(null);
      return;
    }
    e.preventDefault();

    if (tool === 'text') {
      const size = st.size;
      const a: TextAnnot = {
        id: uid('an'),
        pageId: page.id,
        type: 'text',
        x: pt.x,
        y: pt.y - size * 0.6,
        w: 80,
        h: size * LINE_HEIGHT,
        opacity: st.opacity,
        text: '',
        font: st.font,
        size,
        color: st.color === '#ffffff' ? '#111418' : st.color,
        bold: st.bold,
        italic: st.italic,
        underline: false,
        align: 'left',
        bg: null,
      };
      this.store.begin();
      this.store.addAnnot(a);
      this.store.editingId.set(a.id);
      this.store.tool.set('select');
      return;
    }
    if (tool === 'note') {
      const a: Annot = {
        id: uid('an'),
        pageId: page.id,
        type: 'note',
        x: pt.x - 11,
        y: pt.y - 11,
        w: 22,
        h: 22,
        opacity: 1,
        text: '',
        color: st.noteColor,
      };
      this.store.addAnnot(a);
      this.store.editingId.set(a.id);
      this.store.tool.set('select');
      return;
    }
    if (tool === 'symbol') {
      const s = 18;
      this.store.addAnnot(
        { id: uid('an'), pageId: page.id, type: 'symbol', x: pt.x - s / 2, y: pt.y - s / 2, w: s, h: s, opacity: 1, kind: st.symbol, color: st.color === '#ffffff' ? '#111418' : st.color },
        false,
      );
      return;
    }
    if (!DRAG_TOOLS.has(tool)) return;

    const start = pt;
    const inkPts: [number, number][] = [[pt.x, pt.y]];
    const build = (end: { x: number; y: number }, shift: boolean): Annot | null => {
      let x2 = end.x;
      let y2 = end.y;
      const id = this.draft()?.id ?? uid('an');
      const base = { id, pageId: page.id, opacity: st.opacity };
      if (tool === 'ink') {
        return { ...base, type: 'ink', stroke: st.color, strokeWidth: st.strokeWidth, ...normalizePoints(inkPts) } as PathAnnot;
      }
      if (tool === 'line' || tool === 'arrow') {
        if (shift) {
          const ang = Math.round(Math.atan2(y2 - start.y, x2 - start.x) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(x2 - start.x, y2 - start.y);
          x2 = start.x + len * Math.cos(ang);
          y2 = start.y + len * Math.sin(ang);
        }
        return {
          ...base,
          type: tool,
          stroke: st.color,
          strokeWidth: st.strokeWidth,
          ...normalizePoints([
            [start.x, start.y],
            [x2, y2],
          ]),
        } as PathAnnot;
      }
      let w = Math.abs(x2 - start.x);
      let h = Math.abs(y2 - start.y);
      if (shift) w = h = Math.max(w, h);
      const x = x2 < start.x ? start.x - w : start.x;
      const y = y2 < start.y ? start.y - h : start.y;
      if (tool === 'highlight') {
        return { ...base, type: 'highlight', x, y, w, h, color: st.highlightColor, mode: st.highlightMode, opacity: 1 };
      }
      if (tool === 'whiteout') {
        return { ...base, type: 'rect', x, y, w, h, stroke: null, fill: '#ffffff', strokeWidth: 0, opacity: 1 };
      }
      return { ...base, type: tool as 'rect' | 'ellipse', x, y, w, h, stroke: st.color, fill: st.fill, strokeWidth: st.strokeWidth };
    };

    let moved = false;
    this.draft.set(build(start, false));
    this.drag(
      (ev) => {
        const p = this.toBase(ev);
        if (Math.hypot(p.x - start.x, p.y - start.y) > 2) moved = true;
        if (tool === 'ink') {
          const last = inkPts[inkPts.length - 1];
          if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.8 / this.zoom()) inkPts.push([p.x, p.y]);
        }
        this.draft.set(build(p, ev.shiftKey));
      },
      () => {
        let a = this.draft();
        this.draft.set(null);
        if (!a) return;
        if (!moved) {
          if (tool === 'highlight' || tool === 'ink') return;
          // clic sin arrastrar: tamaño por defecto
          if (tool === 'line' || tool === 'arrow') {
            a = { ...(a as PathAnnot), ...normalizePoints([[start.x, start.y], [start.x + 120, start.y]]) };
          } else {
            a = { ...a, x: start.x - 60, y: start.y - 40, w: 120, h: 80 };
          }
        }
        const keepTool = tool === 'ink' || tool === 'highlight' || tool === 'whiteout';
        this.store.addAnnot(a, !keepTool);
        if (!keepTool) this.store.tool.set('select');
      },
    );
  }

  protected onAnnotDown(e: PointerEvent, a: Annot): void {
    if (e.button !== 0) return;
    const tool = this.store.tool();
    if (tool !== 'select' && !(tool === 'editText' && a.type === 'text')) return;
    if (this.store.editingId() === a.id) return;
    e.stopPropagation();
    e.preventDefault();
    this.store.currentPage.set(this.index());
    const wasSelected = this.store.selectedId() === a.id;
    this.finishEditing();
    this.store.selectedId.set(a.id);
    const start = this.toBase(e);
    const orig = { x: a.x, y: a.y };
    let moved = false;
    this.store.begin();
    this.drag(
      (ev) => {
        const p = this.toBase(ev);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (!moved && Math.hypot(dx, dy) * this.zoom() < 3) return;
        moved = true;
        this.store.updateAnnot(a.id, { x: orig.x + dx, y: orig.y + dy });
      },
      () => {
        this.store.end();
        if (!moved && (wasSelected || tool === 'editText') && (a.type === 'text' || a.type === 'note')) this.store.editingId.set(a.id);
        if (!moved && a.type === 'note') this.store.editingId.set(a.id);
      },
    );
  }

  protected onAnnotDblClick(e: MouseEvent, a: Annot): void {
    if (a.type !== 'text' && a.type !== 'note') return;
    e.stopPropagation();
    this.store.selectedId.set(a.id);
    this.store.editingId.set(a.id);
  }

  protected onHandleDown(e: PointerEvent, a: Annot, handle: Handle): void {
    e.stopPropagation();
    e.preventDefault();
    const start = this.toBase(e);
    const o = { ...a } as Annot;
    const keepRatio = a.type === 'image' || a.type === 'symbol' || a.type === 'stamp' || a.type === 'text';
    const endpoints = a.type === 'line' || a.type === 'arrow' ? absolutePoints(a as PathAnnot) : null;
    this.store.begin();
    this.drag(
      (ev) => {
        const p = this.toBase(ev);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (endpoints && (handle === 'p0' || handle === 'p1')) {
          const pts: [number, number][] = endpoints.map((q) => [q[0], q[1]]);
          const i = handle === 'p0' ? 0 : 1;
          pts[i] = [pts[i][0] + dx, pts[i][1] + dy];
          this.store.updateAnnot(a.id, normalizePoints(pts));
          return;
        }
        let x = o.x;
        let y = o.y;
        let w = o.w;
        let h = o.h;
        if (handle.includes('e')) w = o.w + dx;
        if (handle.includes('s')) h = o.h + dy;
        if (handle.includes('w')) {
          w = o.w - dx;
          x = o.x + dx;
        }
        if (handle.includes('n')) {
          h = o.h - dy;
          y = o.y + dy;
        }
        const min = 4;
        if ((keepRatio && handle.length === 2) !== ev.shiftKey && handle.length === 2) {
          const k = Math.max(w / o.w, h / o.h);
          w = o.w * k;
          h = o.h * k;
          if (handle.includes('w')) x = o.x + o.w - w;
          if (handle.includes('n')) y = o.y + o.h - h;
        }
        if (w < min) {
          if (handle.includes('w')) x -= min - w;
          w = min;
        }
        if (h < min) {
          if (handle.includes('n')) y -= min - h;
          h = min;
        }
        if (o.type === 'text') {
          const size = clamp(Math.round(o.size * (w / o.w) * 10) / 10, 4, 400);
          this.store.updateAnnot(a.id, { x, y, size } as Partial<TextAnnot>);
        } else {
          this.store.updateAnnot(a.id, { x, y, w, h });
        }
      },
      () => this.store.end(),
    );
  }

  // ---------------------------------------------------------------------------
  // Edición de texto
  // ---------------------------------------------------------------------------

  protected startLineEdit(e: PointerEvent, line: TextLine): void {
    e.stopPropagation();
    e.preventDefault();
    const page = this.page();
    const guess = guessFont(line.fontRealName || line.fontName, line.fontFamily);
    const size = Math.round(line.size * 10) / 10;
    const colors = this.sampleColors(line);
    const top = line.baseline - baselineOffset(guess.font, guess.bold, guess.italic, size);
    const pad = Math.max(0.6, size * 0.06);
    const a: TextAnnot = {
      id: uid('an'),
      pageId: page.id,
      type: 'text',
      x: line.x,
      y: top,
      w: line.w,
      h: size * LINE_HEIGHT,
      opacity: 1,
      text: line.str,
      font: guess.font,
      size,
      color: colors.text,
      bold: guess.bold,
      italic: guess.italic,
      underline: false,
      align: 'left',
      bg: null,
      cover: { x: line.x - pad, y: line.y - pad, w: line.w + pad * 2, h: line.h + pad * 2, color: colors.bg },
      editOf: line.key,
    };
    this.finishEditing();
    this.store.begin();
    this.store.addAnnot(a);
    this.store.editingId.set(a.id);
  }

  /** Detecta el color del texto y del fondo a partir de los píxeles renderizados. */
  private sampleColors(line: TextLine): { text: string; bg: string } {
    const fallback = { text: '#111418', bg: '#ffffff' };
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !canvas.width) return fallback;
    const k = canvas.width / this.page().w;
    const sx = Math.max(0, Math.floor((line.x - 2) * k));
    const sy = Math.max(0, Math.floor((line.y - 2) * k));
    const sw = Math.min(canvas.width - sx, Math.ceil((line.w + 4) * k));
    const sh = Math.min(canvas.height - sy, Math.ceil((line.h + 4) * k));
    if (sw <= 2 || sh <= 2) return fallback;
    let data: Uint8ClampedArray;
    try {
      data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(sx, sy, sw, sh).data;
    } catch {
      return fallback;
    }
    const counts = new Map<number, number>();
    const px = (i: number) => [data[i], data[i + 1], data[i + 2]];
    const border = (x: number, y: number) => {
      const i = (y * sw + x) * 4;
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };
    for (let x = 0; x < sw; x++) {
      border(x, 0);
      border(x, sh - 1);
    }
    for (let y = 0; y < sh; y++) {
      border(0, y);
      border(sw - 1, y);
    }
    let bestKey = 0;
    let best = -1;
    for (const [key, n] of counts) if (n > best) ((best = n), (bestKey = key));
    const bg = [((bestKey >> 10) & 31) * 8 + 4, ((bestKey >> 5) & 31) * 8 + 4, (bestKey & 31) * 8 + 4];
    // refinar el fondo con la media de los píxeles de borde cercanos al color dominante
    let maxD = 0;
    const dist = (c: number[]) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
    for (let i = 0; i < data.length; i += 4) maxD = Math.max(maxD, dist(px(i)));
    if (maxD < 40) return { text: '#111418', bg: rgbToHex(bg[0], bg[1], bg[2]) };
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const c = px(i);
      if (dist(c) > maxD * 0.75) {
        r += c[0];
        g += c[1];
        b += c[2];
        n++;
      }
    }
    const nearWhite = bg[0] > 240 && bg[1] > 240 && bg[2] > 240;
    return {
      text: n ? rgbToHex(r / n, g / n, b / n) : fallback.text,
      bg: nearWhite ? '#ffffff' : rgbToHex(bg[0], bg[1], bg[2]),
    };
  }

  protected onEditInput(a: TextAnnot): void {
    const el = this.editRef()?.nativeElement;
    if (!el) return;
    const z = this.zoom();
    this.store.updateAnnot(a.id, { text: el.innerText.replace(/\n$/, ''), w: el.offsetWidth / z, h: el.offsetHeight / z } as Partial<TextAnnot>, `text:${a.id}`);
  }

  protected onEditKey(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }

  protected onEditBlur(a: TextAnnot): void {
    const el = this.editRef()?.nativeElement;
    if (el) {
      const text = el.innerText.replace(/\n$/, '');
      if (text !== a.text) this.store.updateAnnot(a.id, { text } as Partial<TextAnnot>, `text:${a.id}`);
    }
    if (this.store.editingId() === a.id) this.store.editingId.set(null);
    const cur = this.store.annots().find((x) => x.id === a.id) as TextAnnot | undefined;
    if (cur && !cur.text.trim() && !cur.cover) this.store.removeAnnot(a.id);
    // toda la sesión de escritura (incluida la creación del cuadro) es un único paso de deshacer
    this.store.end();
  }

  protected onNoteInput(a: Annot, e: Event): void {
    this.store.updateAnnot(a.id, { text: (e.target as HTMLTextAreaElement).value } as Partial<Annot>, `note:${a.id}`);
  }

  protected onNoteKey(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === 'Escape') this.store.editingId.set(null);
  }

  private finishEditing(): void {
    const id = this.store.editingId();
    if (!id) return;
    const active = document.activeElement as HTMLElement | null;
    if (active?.isContentEditable) active.blur();
    this.store.editingId.set(null);
  }

  /** Ajusta el ancho/alto guardado de los textos al tamaño real con el que se dibujan. */
  private syncTextSizes(): void {
    const inner = this.innerRef()?.nativeElement;
    if (!inner) return;
    const z = this.zoom();
    const nodes = inner.querySelectorAll<HTMLElement>('[data-text-id]');
    const patches: { id: string; w: number; h: number }[] = [];
    nodes.forEach((el) => {
      const id = el.dataset['textId']!;
      const a = this.annots().find((x) => x.id === id);
      if (!a || el.dataset['editing']) return;
      const w = el.offsetWidth / z;
      const h = el.offsetHeight / z;
      if (Math.abs(w - a.w) > 0.4 || Math.abs(h - a.h) > 0.4) patches.push({ id, w, h });
    });
    if (!patches.length) return;
    const s = this.store.state();
    const map = new Map(patches.map((p) => [p.id, p]));
    this.store.state.set({ ...s, annots: s.annots.map((a) => (map.has(a.id) ? ({ ...a, ...map.get(a.id)! } as Annot) : a)) });
  }

  // ---------------------------------------------------------------------------
  // Arrastrar archivos sobre la página
  // ---------------------------------------------------------------------------

  protected onDragOver(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  protected async onDrop(e: DragEvent): Promise<void> {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = this.toBase(e);
    const images = files.filter((f) => f.type.startsWith('image/'));
    const pdfs = files.filter((f) => !f.type.startsWith('image/'));
    for (const img of images) {
      const n = await normalizeImage(img);
      placeImage(this.store, this.page(), n.src, n.width * 0.75, n.height * 0.75, { at: pt });
    }
    if (pdfs.length) {
      const added = await this.store.addFiles(pdfs, this.index() + 1);
      if (added) this.ui.toast(`${added} ${added === 1 ? 'página añadida' : 'páginas añadidas'} después de la página ${this.index() + 1}`, 'ok');
    }
  }

  // ---------------------------------------------------------------------------
  // Ayudas para la plantilla
  // ---------------------------------------------------------------------------

  protected asText(a: Annot): TextAnnot {
    return a as TextAnnot;
  }
  protected asPath(a: Annot): PathAnnot {
    return a as PathAnnot;
  }
  protected any(a: Annot): any {
    return a;
  }

  protected pathD(a: Annot): string {
    const p = a as PathAnnot;
    const pts = p.points.map(([x, y]) => [x * p.w, y * p.h] as [number, number]);
    return p.type === 'ink' ? smoothPath(pts) : `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
  }

  protected arrowD(a: Annot): string {
    const p = a as PathAnnot;
    const [s, t] = p.points.map(([x, y]) => [x * p.w, y * p.h]);
    const h = arrowHead(s[0], s[1], t[0], t[1], p.strokeWidth);
    return `M${h[0].join(' ')} L${h[1].join(' ')} L${h[2].join(' ')} Z`;
  }

  protected symbolD(kind: 'check' | 'cross', w: number, h: number): string[] {
    return SYMBOL_PATHS[kind].map((stroke) => 'M' + stroke.map(([x, y]) => `${x * w} ${y * h}`).join(' L'));
  }

  protected stampFont(a: Annot): number {
    const s = a as any;
    let size = a.h * 0.46;
    const tw = measureText(s.label, 'Helvetica, Arial, sans-serif', size, true);
    if (tw > a.w * 0.84) size *= (a.w * 0.84) / tw;
    return size;
  }

  protected stampPath(a: Annot): string {
    const bw = Math.max(1.5, a.h * 0.07);
    return roundedRectPath(bw / 2, bw / 2, a.w - bw, a.h - bw, a.h * 0.18);
  }

  protected handlesFor(a: Annot): Handle[] {
    if (a.type === 'line' || a.type === 'arrow') return ['p0', 'p1'];
    if (a.type === 'note') return [];
    if (a.type === 'text') return ['nw', 'ne', 'se', 'sw'];
    return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  }

  protected handlePos(a: Annot, h: Handle): { left: number; top: number } {
    const z = this.zoom();
    if (h === 'p0' || h === 'p1') {
      const p = a as PathAnnot;
      const pt = p.points[h === 'p0' ? 0 : 1];
      return { left: (a.x + pt[0] * a.w) * z, top: (a.y + pt[1] * a.h) * z };
    }
    const x = h.includes('w') ? a.x : h.includes('e') ? a.x + a.w : a.x + a.w / 2;
    const y = h.includes('n') ? a.y : h.includes('s') ? a.y + a.h : a.y + a.h / 2;
    return { left: x * z, top: y * z };
  }

  protected numberLabel(): string {
    const pn = this.store.state().pageNumbers;
    const total = this.store.pages().length;
    const i = this.index();
    if (pn.skipFirst && i === 0) return '';
    return pageNumberText(pn.format, i + pn.startAt - (pn.skipFirst ? 1 : 0), total + pn.startAt - 1 - (pn.skipFirst ? 1 : 0));
  }

  protected selectPage(): void {
    this.store.currentPage.set(this.index());
  }
}
