import { Injectable, computed, inject } from '@angular/core';
import type {
  Annotation,
  AnnotationPatch,
  FontId,
  HighlightMode,
  SymbolKind,
  TextAlign,
  ToolId,
  ToolStyle,
} from '@core/models';
import { DocumentStore, EditorStore } from '@core/state';
import { clamp } from '@core/utils';

export type PanelKind =
  | 'text'
  | 'shape'
  | 'stroke'
  | 'highlight'
  | 'note'
  | 'stamp'
  | 'symbol'
  | 'image'
  | 'edit-text-hint'
  | 'whiteout-hint';

const RANGES = {
  strokeWidth: [0.5, 40],
  opacity: [0.05, 1],
  size: [4, 300],
  symbolSize: [6, 80],
} as const;

function panelForAnnotation(a: Annotation): PanelKind {
  switch (a.type) {
    case 'rect':
    case 'ellipse':
      return 'shape';
    case 'line':
    case 'arrow':
    case 'ink':
      return 'stroke';
    default:
      return a.type;
  }
}

function panelForTool(tool: ToolId): PanelKind | null {
  switch (tool) {
    case 'text':
    case 'highlight':
    case 'note':
    case 'symbol':
      return tool;
    case 'rect':
    case 'ellipse':
      return 'shape';
    case 'line':
    case 'arrow':
    case 'ink':
      return 'stroke';
    case 'edit-text':
      return 'edit-text-hint';
    case 'whiteout':
      return 'whiteout-hint';
    default:
      return null;
  }
}

/**
 * Lo que edita el panel de propiedades: la anotación seleccionada o, si no hay ninguna,
 * el estilo con el que la herramienta activa creará la siguiente. Los paneles leen y escriben
 * a través de este servicio sin saber cuál de los dos casos es.
 *
 * Se provee en `InspectorComponent`, así que vive y muere con el panel.
 */
@Injectable()
export class InspectorTargetService {
  private readonly documentStore = inject(DocumentStore);
  private readonly editorStore = inject(EditorStore);

  readonly annotation = this.editorStore.selectedAnnotation;
  private readonly style = this.editorStore.toolStyle;

  readonly panel = computed<PanelKind | null>(() => {
    const a = this.annotation();
    return a ? panelForAnnotation(a) : panelForTool(this.editorStore.tool());
  });

  // --- Valores ---------------------------------------------------------------------

  /** Color principal: tinta del texto, trazo, resaltador, nota… */
  readonly color = computed(() => {
    const a = this.annotation();
    if (a) {
      if ('color' in a) return a.color;
      if ('stroke' in a) return a.stroke ?? '#000000';
      return '#000000';
    }
    const tool = this.editorStore.tool();
    if (tool === 'highlight') return this.style().highlightColor;
    if (tool === 'note') return this.style().noteColor;
    return this.style().color;
  });

  readonly stroke = computed(() => {
    const a = this.annotation();
    return a && 'stroke' in a ? a.stroke : this.style().color;
  });

  readonly fill = computed(() => {
    const a = this.annotation();
    return a && 'fill' in a ? a.fill : this.style().fill;
  });

  readonly strokeWidth = computed(() => this.pick('strokeWidth', 'strokeWidth'));
  readonly opacity = computed(() => this.annotation()?.opacity ?? this.style().opacity);
  readonly font = computed<FontId>(() => this.pick('font', 'font'));
  readonly size = computed(() => this.pick('size', 'size'));
  readonly bold = computed(() => this.pick('bold', 'bold'));
  readonly italic = computed(() => this.pick('italic', 'italic'));
  readonly underline = computed(() => {
    const a = this.annotation();
    return a?.type === 'text' ? a.underline : false;
  });
  readonly highlightMode = computed<HighlightMode>(() => {
    const a = this.annotation();
    return a?.type === 'highlight' ? a.mode : this.style().highlightMode;
  });
  readonly symbol = computed<SymbolKind>(() => {
    const a = this.annotation();
    return a?.type === 'symbol' ? a.kind : this.style().symbol;
  });

  // --- Cambios ---------------------------------------------------------------------

  setColor(color: string | null): void {
    if (!color) return;
    const a = this.annotation();
    if (a) {
      this.patch('stroke' in a && !('color' in a) ? { stroke: color } : { color }, 'color');
      return;
    }
    const tool = this.editorStore.tool();
    if (tool === 'highlight') this.editorStore.updateToolStyle({ highlightColor: color });
    else if (tool === 'note') this.editorStore.updateToolStyle({ noteColor: color });
    else this.editorStore.updateToolStyle({ color });
  }

  /** Borde de una forma. No se permite quitar a la vez borde y relleno. */
  setStroke(stroke: string | null): void {
    const a = this.annotation();
    if (!a) {
      if (stroke) this.editorStore.updateToolStyle({ color: stroke });
      return;
    }
    if (!stroke && !('fill' in a && a.fill)) return;
    this.patch({ stroke }, 'stroke');
  }

  setFill(fill: string | null): void {
    const a = this.annotation();
    if (!a) {
      this.editorStore.updateToolStyle({ fill });
      return;
    }
    if (!fill && !('stroke' in a && a.stroke)) return;
    this.patch({ fill }, 'fill');
  }

  setStrokeWidth(value: number): void {
    this.setNumber('strokeWidth', value);
  }

  setOpacity(value: number): void {
    this.setNumber('opacity', value);
  }

  setSize(value: number): void {
    this.setNumber('size', value);
  }

  setFont(font: FontId): void {
    this.setStyle({ font });
  }

  toggle(property: 'bold' | 'italic' | 'underline'): void {
    const current = property === 'underline' ? this.underline() : this[property]();
    if (property === 'underline') this.patch({ underline: !current });
    else this.setStyle({ [property]: !current });
  }

  setAlign(align: TextAlign): void {
    this.patch({ align });
  }

  setBackground(background: string | null): void {
    this.patch({ background });
  }

  setHighlightMode(mode: HighlightMode): void {
    if (this.annotation()) this.patch({ mode });
    else this.editorStore.updateToolStyle({ highlightMode: mode });
  }

  setSymbol(kind: SymbolKind): void {
    if (this.annotation()) this.patch({ kind });
    else this.editorStore.updateToolStyle({ symbol: kind });
  }

  /** Cambia el tamaño de una marca manteniéndola centrada. */
  setSymbolSize(value: number): void {
    const a = this.annotation();
    if (!a || Number.isNaN(value)) return;
    const size = clamp(value, RANGES.symbolSize[0], RANGES.symbolSize[1]);
    this.patch(
      { w: size, h: size, x: a.x + a.w / 2 - size / 2, y: a.y + a.h / 2 - size / 2 },
      'symbol-size',
    );
  }

  setCoverColor(color: string | null): void {
    const a = this.annotation();
    if (a?.type !== 'text' || !a.cover || !color) return;
    this.patch({ cover: { ...a.cover, color } }, 'cover');
  }

  setStampLabel(label: string): void {
    this.patch({ label: label.toUpperCase() }, 'label');
  }

  setNoteText(text: string): void {
    this.patch({ text }, 'text');
  }

  // --- Interno -----------------------------------------------------------------------

  private pick<K extends keyof ToolStyle & keyof AnnotationPatch>(
    annotationKey: K,
    styleKey: K,
  ): ToolStyle[K] {
    const a = this.annotation() as (Annotation & Partial<Record<K, ToolStyle[K]>>) | null;
    const value = a?.[annotationKey];
    return value !== undefined ? value : this.style()[styleKey];
  }

  private setNumber(key: 'strokeWidth' | 'opacity' | 'size', value: number): void {
    if (Number.isNaN(value)) return;
    this.setStyle({ [key]: clamp(value, RANGES[key][0], RANGES[key][1]) });
  }

  /** Propiedades que existen tanto en la anotación como en el estilo de la herramienta. */
  private setStyle(patch: Partial<ToolStyle> & AnnotationPatch): void {
    if (this.annotation()) this.patch(patch, Object.keys(patch).join(','));
    else this.editorStore.updateToolStyle(patch);
  }

  private patch(patch: AnnotationPatch, coalesce?: string): void {
    const a = this.annotation();
    if (a)
      this.documentStore.updateAnnotation(
        a.id,
        patch,
        `inspector:${a.id}:${coalesce ?? Object.keys(patch).join(',')}`,
      );
  }
}
