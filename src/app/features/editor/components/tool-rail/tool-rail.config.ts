import type { SymbolKind, ToolId } from '@core/models';
import type { IconName } from '@shared/components';

export interface ToolOption {
  readonly tool: ToolId;
  readonly icon: IconName;
  readonly label: string;
  readonly shortcut?: string;
}

export type ToolAction = 'image' | 'signature' | 'stamp';

export type RailItem =
  | ({ readonly kind: 'tool' } & ToolOption)
  | {
      readonly kind: 'action';
      readonly action: ToolAction;
      readonly icon: IconName;
      readonly label: string;
      readonly shortcut?: string;
    }
  | { readonly kind: 'menu'; readonly menu: 'shapes' | 'symbols'; readonly label: string };

export const SHAPE_TOOLS: readonly ToolOption[] = [
  { tool: 'rect', icon: 'rect', label: 'Rectángulo', shortcut: 'R' },
  { tool: 'ellipse', icon: 'ellipse', label: 'Elipse', shortcut: 'O' },
  { tool: 'line', icon: 'line', label: 'Línea', shortcut: 'L' },
  { tool: 'arrow', icon: 'arrow', label: 'Flecha', shortcut: 'A' },
];

export const SYMBOL_OPTIONS: readonly {
  readonly kind: SymbolKind;
  readonly icon: IconName;
  readonly label: string;
}[] = [
  { kind: 'check', icon: 'check', label: 'Visto bueno' },
  { kind: 'cross', icon: 'cross', label: 'Aspa' },
  { kind: 'dot', icon: 'dot', label: 'Punto' },
];

/** Herramientas agrupadas tal y como aparecen en la barra. */
export const RAIL_GROUPS: readonly (readonly RailItem[])[] = [
  [
    { kind: 'tool', tool: 'select', icon: 'select', label: 'Seleccionar y mover', shortcut: 'V' },
    {
      kind: 'tool',
      tool: 'edit-text',
      icon: 'editText',
      label: 'Editar texto del PDF',
      shortcut: 'E',
    },
  ],
  [
    { kind: 'tool', tool: 'text', icon: 'text', label: 'Añadir texto', shortcut: 'T' },
    { kind: 'tool', tool: 'highlight', icon: 'highlight', label: 'Resaltar', shortcut: 'H' },
    { kind: 'tool', tool: 'ink', icon: 'pen', label: 'Dibujar a mano', shortcut: 'D' },
    { kind: 'menu', menu: 'shapes', label: 'Formas' },
    { kind: 'tool', tool: 'whiteout', icon: 'whiteout', label: 'Tapar (corrector)', shortcut: 'W' },
  ],
  [
    { kind: 'action', action: 'image', icon: 'image', label: 'Insertar imagen', shortcut: 'I' },
    { kind: 'action', action: 'signature', icon: 'signature', label: 'Firmar', shortcut: 'S' },
    { kind: 'tool', tool: 'note', icon: 'note', label: 'Comentario', shortcut: 'N' },
    { kind: 'action', action: 'stamp', icon: 'stamp', label: 'Sello' },
    { kind: 'menu', menu: 'symbols', label: 'Marcas ✓ ✗' },
  ],
];

export const TOOL_LABELS: Readonly<Record<ToolId, string>> = {
  select: 'Seleccionar',
  'edit-text': 'Editar texto',
  text: 'Añadir texto',
  highlight: 'Resaltar',
  ink: 'Dibujar',
  rect: 'Rectángulo',
  ellipse: 'Elipse',
  line: 'Línea',
  arrow: 'Flecha',
  whiteout: 'Tapar',
  note: 'Comentario',
  symbol: 'Marcas',
};
