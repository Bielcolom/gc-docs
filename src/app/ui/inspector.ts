import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { DocumentStore } from '../core/document.store';
import { FONTS } from '../core/fonts';
import { HIGHLIGHT_COLORS, PALETTE, STAMPS } from '../core/actions';
import { Annot, FontId, TextAnnot, ToolId } from '../core/models';
import { clamp } from '../core/util';
import { Icon } from './icon';
import { PageActions } from './page-actions';
import { Swatches } from './swatches';
import { TOOL_LABELS } from './tool-rail';
import { UiService } from './ui.service';

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  rect: 'Rectángulo',
  ellipse: 'Elipse',
  line: 'Línea',
  arrow: 'Flecha',
  ink: 'Trazo a mano',
  highlight: 'Resaltado',
  image: 'Imagen',
  note: 'Comentario',
  stamp: 'Sello',
  symbol: 'Marca',
};

type Kind = 'text' | 'shape' | 'path' | 'highlight' | 'image' | 'note' | 'stamp' | 'symbol' | 'whiteout' | 'editText' | null;

@Component({
  selector: 'app-inspector',
  imports: [Icon, Swatches, DecimalPipe, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspector.html',
  styleUrl: './inspector.css',
})
export class Inspector {
  protected readonly store = inject(DocumentStore);
  protected readonly ui = inject(UiService);
  protected readonly actions = inject(PageActions);

  protected readonly FONTS = FONTS;
  protected readonly fontGroups = ['Clásicas', 'Modernas', 'Manuscritas'] as const;
  protected readonly PALETTE = PALETTE;
  protected readonly HIGHLIGHT_COLORS = HIGHLIGHT_COLORS;
  protected readonly STAMP_COLORS = [...new Set(STAMPS.map((s) => s.color))];

  protected readonly sel = this.store.selectedAnnot;

  /** Qué conjunto de controles mostrar */
  protected readonly kind = computed<Kind>(() => {
    const a = this.sel();
    if (a) return kindOfAnnot(a);
    return kindOfTool(this.store.tool());
  });

  protected readonly title = computed(() => {
    const a = this.sel();
    if (a) {
      if (a.type === 'text' && a.cover) return 'Texto editado';
      if (a.type === 'image' && a.isSignature) return 'Firma';
      if (a.type === 'rect' && a.fill === '#ffffff' && !a.stroke) return 'Corrector';
      return TYPE_LABELS[a.type];
    }
    return this.kind() ? (TOOL_LABELS[this.store.tool()] ?? 'Documento') : 'Documento';
  });

  protected readonly pageNumber = computed(() => {
    const a = this.sel();
    return a ? this.store.pageIndex(a.pageId) + 1 : this.store.currentPage() + 1;
  });

  protected readonly editCount = computed(() => this.store.annots().length);

  // ---------------------------------------------------------------------------
  // Lectura de valores (anotación seleccionada o estilo de la herramienta)
  // ---------------------------------------------------------------------------

  protected v(): any {
    return this.sel() ?? null;
  }

  protected color(): string {
    const a = this.sel() as any;
    const st = this.store.style();
    if (a) return a.color ?? a.stroke ?? '#000000';
    if (this.store.tool() === 'highlight') return st.highlightColor;
    if (this.store.tool() === 'note') return st.noteColor;
    return st.color;
  }

  protected setColor(c: string | null): void {
    if (!c) return;
    const a = this.sel();
    if (a) {
      if (a.type === 'line' || a.type === 'arrow' || a.type === 'ink') this.patch({ stroke: c });
      else if (a.type === 'rect' || a.type === 'ellipse') this.patch({ stroke: c });
      else this.patch({ color: c } as Partial<Annot>);
      return;
    }
    const t = this.store.tool();
    if (t === 'highlight') this.store.style.update((s) => ({ ...s, highlightColor: c }));
    else if (t === 'note') this.store.style.update((s) => ({ ...s, noteColor: c }));
    else this.store.style.update((s) => ({ ...s, color: c }));
  }

  protected stroke(): string | null {
    const a = this.sel() as any;
    if (a) return a.stroke ?? null;
    return this.store.style().color;
  }

  protected setStroke(c: string | null): void {
    const a = this.sel();
    if (a) {
      if (!c && !(a as any).fill) return;
      this.patch({ stroke: c } as Partial<Annot>);
    } else if (c) this.store.style.update((s) => ({ ...s, color: c }));
  }

  protected fill(): string | null {
    const a = this.sel() as any;
    if (a) return a.fill ?? null;
    return this.store.style().fill;
  }

  protected setFill(c: string | null): void {
    const a = this.sel();
    if (a) {
      if (!c && !(a as any).stroke) return;
      this.patch({ fill: c } as Partial<Annot>);
    } else this.store.style.update((s) => ({ ...s, fill: c }));
  }

  protected num(key: 'strokeWidth' | 'opacity' | 'size'): number {
    const a = this.sel() as any;
    if (a) return a[key] ?? 1;
    return (this.store.style() as any)[key];
  }

  protected setNum(key: 'strokeWidth' | 'opacity' | 'size', value: number): void {
    if (Number.isNaN(value)) return;
    const ranges = { strokeWidth: [0.5, 40], opacity: [0.05, 1], size: [4, 300] } as const;
    const v = clamp(value, ranges[key][0], ranges[key][1]);
    const a = this.sel();
    if (a) {
      if (key === 'size' && a.type === 'symbol') {
        const cx = a.x + a.w / 2;
        const cy = a.y + a.h / 2;
        this.patch({ w: v, h: v, x: cx - v / 2, y: cy - v / 2 });
      } else this.patch({ [key]: v } as Partial<Annot>, key);
    } else this.store.style.update((s) => ({ ...s, [key]: v }));
  }

  protected flag(key: 'bold' | 'italic' | 'underline'): boolean {
    const a = this.sel() as any;
    if (a) return !!a[key];
    return !!(this.store.style() as any)[key];
  }

  protected toggle(key: 'bold' | 'italic' | 'underline'): void {
    const val = !this.flag(key);
    if (this.sel()) this.patch({ [key]: val } as Partial<Annot>);
    else this.store.style.update((s) => ({ ...s, [key]: val }));
  }

  protected font(): FontId {
    const a = this.sel() as any;
    return a?.font ?? this.store.style().font;
  }

  protected setFont(f: string): void {
    if (this.sel()) this.patch({ font: f as FontId } as Partial<Annot>);
    else this.store.style.update((s) => ({ ...s, font: f as FontId }));
  }

  protected highlightMode(): string {
    const a = this.sel() as any;
    return a?.mode ?? this.store.style().highlightMode;
  }

  protected setHighlightMode(m: 'highlight' | 'underline' | 'strike'): void {
    if (this.sel()) this.patch({ mode: m } as Partial<Annot>);
    else this.store.style.update((s) => ({ ...s, highlightMode: m }));
  }

  protected symbolKind(): string {
    const a = this.sel() as any;
    return a?.kind ?? this.store.style().symbol;
  }

  protected setSymbol(k: 'check' | 'cross' | 'dot'): void {
    if (this.sel()) this.patch({ kind: k } as Partial<Annot>);
    else this.store.style.update((s) => ({ ...s, symbol: k }));
  }

  protected patch(p: Partial<Annot>, coalesce?: string): void {
    const a = this.sel();
    if (!a) return;
    this.store.updateAnnot(a.id, p, `insp:${a.id}:${coalesce ?? Object.keys(p).join(',')}`);
  }

  protected asText(a: Annot | null): TextAnnot | null {
    return a && a.type === 'text' ? a : null;
  }

  protected setCoverColor(c: string | null): void {
    const a = this.asText(this.sel());
    if (!a?.cover || !c) return;
    this.patch({ cover: { ...a.cover, color: c } } as Partial<Annot>, 'cover');
  }

  protected restoreOriginal(): void {
    const a = this.sel();
    if (a) this.store.removeAnnot(a.id);
    this.ui.toast('Texto original restaurado', 'ok');
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected numVal(e: Event): number {
    return parseFloat((e.target as HTMLInputElement).value);
  }
}

function kindOfAnnot(a: Annot): Kind {
  switch (a.type) {
    case 'text':
      return 'text';
    case 'rect':
    case 'ellipse':
      return 'shape';
    case 'line':
    case 'arrow':
    case 'ink':
      return 'path';
    default:
      return a.type;
  }
}

function kindOfTool(t: ToolId): Kind {
  switch (t) {
    case 'text':
      return 'text';
    case 'rect':
    case 'ellipse':
      return 'shape';
    case 'line':
    case 'arrow':
    case 'ink':
      return 'path';
    case 'highlight':
      return 'highlight';
    case 'note':
      return 'note';
    case 'symbol':
      return 'symbol';
    case 'whiteout':
      return 'whiteout';
    case 'editText':
      return 'editText';
    default:
      return null;
  }
}
