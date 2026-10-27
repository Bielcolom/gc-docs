import type { HighlightMode, SymbolKind } from './annotation.model';
import type { FontId } from './font.model';

export type ToolId =
  | 'select'
  | 'edit-text'
  | 'text'
  | 'highlight'
  | 'ink'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'whiteout'
  | 'note'
  | 'symbol';

/** Estilos que usan las herramientas para crear anotaciones nuevas. */
export interface ToolStyle {
  readonly color: string;
  readonly fill: string | null;
  readonly strokeWidth: number;
  readonly opacity: number;
  readonly font: FontId;
  readonly size: number;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly highlightColor: string;
  readonly highlightMode: HighlightMode;
  readonly symbol: SymbolKind;
  readonly noteColor: string;
}
