import type { ToolStyle } from '@core/models';

export const DEFAULT_TOOL_STYLE: ToolStyle = {
  color: '#1d3a8a',
  fill: null,
  strokeWidth: 2,
  opacity: 1,
  font: 'helvetica',
  size: 14,
  bold: false,
  italic: false,
  highlightColor: '#ffe14d',
  highlightMode: 'highlight',
  symbol: 'check',
  noteColor: '#f5c518',
};

export const ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
] as const;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 5;
/** Zoom máximo al ajustar automáticamente un documento recién abierto. */
export const MAX_INITIAL_ZOOM = 1.25;

/** Límite de píxeles por lienzo, para no agotar la memoria en páginas grandes. */
export const MAX_CANVAS_PIXELS = 14_000_000;
export const MAX_DEVICE_PIXEL_RATIO = 2.5;

/** Margen con el que se empiezan a dibujar las páginas antes de entrar en pantalla. */
export const PAGE_PRELOAD_MARGIN = '900px 0px';
export const THUMBNAIL_PRELOAD_MARGIN = '300px 0px';

/** Distancia mínima (px) para considerar que un clic es un arrastre. */
export const DRAG_THRESHOLD_PX = 4;

export const NOTE_SIZE = 22;
export const SYMBOL_SIZE = 18;
export const DEFAULT_SHAPE_SIZE = { w: 120, h: 80 } as const;
export const DEFAULT_LINE_LENGTH = 120;
export const PASTE_OFFSET = 12;

export const PALETTE = [
  '#111418',
  '#4a4f55',
  '#1d3a8a',
  '#2a6fdb',
  '#0f7b6c',
  '#1f7a45',
  '#c98a00',
  '#d9480f',
  '#b3261e',
  '#8e3fb8',
  '#ffffff',
] as const;

export const HIGHLIGHT_COLORS = ['#ffe14d', '#9cf08c', '#7fd8ff', '#ffa8d5', '#ffb86b'] as const;
export const NOTE_COLORS = ['#f5c518', '#ff9f43', '#7fd8ff', '#9cf08c', '#ffa8d5'] as const;
export const COVER_COLORS = ['#ffffff', '#f4f1e8', '#e9eef5', '#111418'] as const;
export const SIGNATURE_INKS = ['#111418', '#1d3a8a', '#2a6fdb'] as const;

export interface StampPreset {
  readonly label: string;
  readonly color: string;
}

export const STAMP_PRESETS: readonly StampPreset[] = [
  { label: 'APROBADO', color: '#1f7a45' },
  { label: 'PAGADO', color: '#1f7a45' },
  { label: 'REVISADO', color: '#1d3a8a' },
  { label: 'RECIBIDO', color: '#1d3a8a' },
  { label: 'BORRADOR', color: '#6b5d2a' },
  { label: 'CONFIDENCIAL', color: '#b3261e' },
  { label: 'RECHAZADO', color: '#b3261e' },
  { label: 'URGENTE', color: '#b3261e' },
  { label: 'COPIA', color: '#4a4f55' },
  { label: 'ORIGINAL', color: '#4a4f55' },
];
export const STAMP_COLORS = [
  '#1d3a8a',
  '#1f7a45',
  '#b3261e',
  '#6b5d2a',
  '#4a4f55',
  '#8e3fb8',
] as const;

/** Colores que identifican cada archivo de origen en el organizador. */
export const SOURCE_COLORS = [
  '#2a6fdb',
  '#e0a800',
  '#1f9d55',
  '#d9480f',
  '#8e3fb8',
  '#0f8a7e',
  '#c2255c',
  '#6b5d2a',
  '#4a4f55',
  '#5c7cfa',
] as const;
