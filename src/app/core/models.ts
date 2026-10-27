/**
 * Modelo de datos del editor.
 *
 * Coordenadas: todas las anotaciones se guardan en el "espacio base" de la página,
 * que es la vista de pdf.js a escala 1 con la rotación propia del PDF aplicada.
 * Unidades en puntos PDF (1/72"), origen arriba a la izquierda, eje Y hacia abajo.
 * La rotación que añade el usuario se aplica encima (visualmente y al exportar).
 */

export type Rotation = 0 | 90 | 180 | 270;

/** Un PDF cargado (archivo abierto, páginas en blanco generadas, imágenes convertidas...). */
export interface SourceInfo {
  id: string;
  name: string;
  pageCount: number;
  /** true si el archivo no se puede reescribir con pdf-lib (cifrado) y se exporta como imagen. */
  encrypted?: boolean;
}

/** Una página del documento final. */
export interface PageRef {
  id: string;
  srcId: string;
  srcIndex: number;
  /** Rotación añadida por el usuario. */
  rotation: Rotation;
  /** Tamaño en el espacio base (pt). */
  w: number;
  h: number;
  /** Transformación de pdf.js (espacio PDF -> espacio base, escala 1). */
  vt: number[];
}

export type FontId =
  | 'helvetica'
  | 'times'
  | 'courier'
  | 'roboto'
  | 'lora'
  | 'roboto-mono'
  | 'dancing'
  | 'greatvibes'
  | 'caveat';

export type AnnotType =
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'ink'
  | 'highlight'
  | 'image'
  | 'note'
  | 'stamp'
  | 'symbol';

interface AnnotBase {
  id: string;
  pageId: string;
  type: AnnotType;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
}

export interface TextAnnot extends AnnotBase {
  type: 'text';
  text: string;
  font: FontId;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  /** Fondo opcional de la caja de texto. */
  bg: string | null;
  /** Si es una edición de texto original: zona que se tapa y su color. */
  cover?: { x: number; y: number; w: number; h: number; color: string };
  /** Clave de la línea original editada (para ocultarla en el modo "Editar texto"). */
  editOf?: string;
}

export interface ShapeAnnot extends AnnotBase {
  type: 'rect' | 'ellipse';
  stroke: string | null;
  fill: string | null;
  strokeWidth: number;
  radius?: number;
}

export interface PathAnnot extends AnnotBase {
  type: 'line' | 'arrow' | 'ink';
  stroke: string;
  strokeWidth: number;
  /** Puntos normalizados (0..1) dentro de la caja x,y,w,h. */
  points: [number, number][];
}

export interface HighlightAnnot extends AnnotBase {
  type: 'highlight';
  color: string;
  mode: 'highlight' | 'underline' | 'strike';
}

export interface ImageAnnot extends AnnotBase {
  type: 'image';
  /** data URL (PNG o JPEG). */
  src: string;
  isSignature?: boolean;
}

export interface NoteAnnot extends AnnotBase {
  type: 'note';
  text: string;
  color: string;
}

export interface StampAnnot extends AnnotBase {
  type: 'stamp';
  label: string;
  color: string;
}

export interface SymbolAnnot extends AnnotBase {
  type: 'symbol';
  kind: 'check' | 'cross' | 'dot';
  color: string;
}

export type Annot =
  | TextAnnot
  | ShapeAnnot
  | PathAnnot
  | HighlightAnnot
  | ImageAnnot
  | NoteAnnot
  | StampAnnot
  | SymbolAnnot;

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  size: number;
  color: string;
  opacity: number;
  angle: number;
}

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';

export interface PageNumberSettings {
  enabled: boolean;
  format: string;
  position: NumberPosition;
  size: number;
  color: string;
  startAt: number;
  skipFirst: boolean;
}

export interface MetadataSettings {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

/** Estado "deshacer-able" del documento. */
export interface DocState {
  pages: PageRef[];
  annots: Annot[];
  /** Valores de formulario: clave `${srcId}::${nombreCampo}`. */
  forms: Record<string, string | boolean>;
  watermark: WatermarkSettings;
  pageNumbers: PageNumberSettings;
  meta: MetadataSettings;
}

export type ToolId =
  | 'select'
  | 'editText'
  | 'text'
  | 'highlight'
  | 'ink'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'whiteout'
  | 'note'
  | 'symbol'
  | 'pan';

/** Estilos por defecto que usan las herramientas al crear anotaciones. */
export interface ToolStyle {
  color: string;
  fill: string | null;
  strokeWidth: number;
  opacity: number;
  font: FontId;
  size: number;
  bold: boolean;
  italic: boolean;
  highlightColor: string;
  highlightMode: 'highlight' | 'underline' | 'strike';
  symbol: 'check' | 'cross' | 'dot';
  noteColor: string;
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  text: 'CONFIDENCIAL',
  size: 64,
  color: '#c2412d',
  opacity: 0.18,
  angle: 45,
};

export const DEFAULT_PAGE_NUMBERS: PageNumberSettings = {
  enabled: false,
  format: '{n} / {total}',
  position: 'bottom-center',
  size: 10,
  color: '#4a4f55',
  startAt: 1,
  skipFirst: false,
};

export const EMPTY_META: MetadataSettings = { title: '', author: '', subject: '', keywords: '' };
