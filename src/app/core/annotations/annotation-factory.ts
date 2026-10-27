/**
 * Creación de anotaciones nuevas a partir de las acciones del usuario.
 * Funciones puras: reciben todo lo que necesitan y devuelven el objeto listo para guardar.
 */
import { DEFAULT_LINE_LENGTH, DEFAULT_SHAPE_SIZE, NOTE_SIZE, SYMBOL_SIZE } from '@core/constants';
import type {
  Annotation,
  FontStyle,
  ImageAnnotation,
  NoteAnnotation,
  PageRef,
  PathAnnotation,
  Point,
  StampAnnotation,
  SymbolAnnotation,
  TextAnnotation,
  TextLine,
  ToolId,
  ToolStyle,
} from '@core/models';
import { createId, normalizePoints, rectFromPoints, snapAngle } from '@core/utils';

const INK_ON_WHITE = '#111418';
/** Proporción de la página que puede ocupar como máximo una imagen recién insertada. */
const MAX_IMAGE_FRACTION = 0.45;
const STAMP_HEIGHT = 34;
const STAMP_MIN_WIDTH = 80;
const STAMP_TEXT_RATIO = 0.46;

/** El blanco sirve para tapar, pero no para escribir: se cambia por tinta oscura. */
const readableColor = (color: string): string =>
  color.toLowerCase() === '#ffffff' ? INK_ON_WHITE : color;

export type DragTool = Extract<
  ToolId,
  'rect' | 'ellipse' | 'line' | 'arrow' | 'highlight' | 'whiteout' | 'ink'
>;

export const DRAG_TOOLS: ReadonlySet<ToolId> = new Set<DragTool>([
  'rect',
  'ellipse',
  'line',
  'arrow',
  'highlight',
  'whiteout',
  'ink',
]);

export const isDragTool = (tool: ToolId): tool is DragTool => DRAG_TOOLS.has(tool);

/** Anotación que se va dibujando mientras el usuario arrastra. */
export function createFromDrag(
  tool: DragTool,
  id: string,
  pageId: string,
  points: readonly Point[],
  style: ToolStyle,
  constrain: boolean,
): Annotation {
  const start = points[0];
  const end = points[points.length - 1];
  const base = { id, pageId, opacity: style.opacity };
  switch (tool) {
    case 'ink':
      return {
        ...base,
        type: 'ink',
        stroke: style.color,
        strokeWidth: style.strokeWidth,
        ...normalizePoints(points),
      };
    case 'line':
    case 'arrow':
      return {
        ...base,
        type: tool,
        stroke: style.color,
        strokeWidth: style.strokeWidth,
        ...normalizePoints([start, constrain ? snapAngle(start, end) : end]),
      };
    case 'highlight':
      return {
        ...base,
        type: 'highlight',
        opacity: 1,
        color: style.highlightColor,
        mode: style.highlightMode,
        ...rectFromPoints(start, end),
      };
    case 'whiteout':
      return {
        ...base,
        type: 'rect',
        opacity: 1,
        stroke: null,
        fill: '#ffffff',
        strokeWidth: 0,
        ...rectFromPoints(start, end),
      };
    case 'rect':
    case 'ellipse':
      return {
        ...base,
        type: tool,
        stroke: style.color,
        fill: style.fill,
        strokeWidth: style.strokeWidth,
        ...rectFromPoints(start, end, constrain),
      };
  }
}

/** Tamaño por defecto cuando el usuario hace clic sin arrastrar. */
export function withDefaultSize(annotation: Annotation, at: Point): Annotation {
  if (annotation.type === 'line' || annotation.type === 'arrow') {
    return {
      ...annotation,
      ...normalizePoints([at, { x: at.x + DEFAULT_LINE_LENGTH, y: at.y }]),
    } as PathAnnotation;
  }
  const { w, h } = DEFAULT_SHAPE_SIZE;
  return { ...annotation, x: at.x - w / 2, y: at.y - h / 2, w, h };
}

export function createText(pageId: string, at: Point, style: ToolStyle): TextAnnotation {
  return {
    id: createId('an'),
    pageId,
    type: 'text',
    x: at.x,
    y: at.y - style.size * 0.6,
    w: 80,
    h: style.size * 1.2,
    opacity: style.opacity,
    text: '',
    font: style.font,
    size: style.size,
    color: readableColor(style.color),
    bold: style.bold,
    italic: style.italic,
    underline: false,
    align: 'left',
    background: null,
  };
}

export interface SampledColors {
  readonly text: string;
  readonly background: string;
}

/**
 * Edición de una línea de texto original: un texto nuevo en la misma posición
 * y un parche del color del fondo que tapa el texto anterior.
 */
export function createTextEdit(
  pageId: string,
  line: TextLine,
  font: FontStyle,
  colors: SampledColors,
  baselineOffset: number,
): TextAnnotation {
  const size = Math.round(line.fontSize * 10) / 10;
  const pad = Math.max(0.6, size * 0.06);
  return {
    id: createId('an'),
    pageId,
    type: 'text',
    x: line.x,
    y: line.baseline - baselineOffset,
    w: line.width,
    h: size * 1.2,
    opacity: 1,
    text: line.text,
    font: font.font,
    size,
    color: colors.text,
    bold: font.bold,
    italic: font.italic,
    underline: false,
    align: 'left',
    background: null,
    cover: {
      x: line.x - pad,
      y: line.y - pad,
      w: line.width + pad * 2,
      h: line.height + pad * 2,
      color: colors.background,
    },
    editOf: line.key,
  };
}

export function createNote(pageId: string, at: Point, color: string): NoteAnnotation {
  return {
    id: createId('an'),
    pageId,
    type: 'note',
    x: at.x - NOTE_SIZE / 2,
    y: at.y - NOTE_SIZE / 2,
    w: NOTE_SIZE,
    h: NOTE_SIZE,
    opacity: 1,
    text: '',
    color,
  };
}

export function createSymbol(pageId: string, at: Point, style: ToolStyle): SymbolAnnotation {
  return {
    id: createId('an'),
    pageId,
    type: 'symbol',
    x: at.x - SYMBOL_SIZE / 2,
    y: at.y - SYMBOL_SIZE / 2,
    w: SYMBOL_SIZE,
    h: SYMBOL_SIZE,
    opacity: 1,
    kind: style.symbol,
    color: readableColor(style.color),
  };
}

/** Imagen centrada en `at` (o en la página) y reducida si es demasiado grande. */
export function createImage(
  page: PageRef,
  src: string,
  naturalSize: { width: number; height: number },
  options: { at?: Point; isSignature?: boolean; maxWidth?: number } = {},
): ImageAnnotation {
  const maxW = options.maxWidth ?? page.width * MAX_IMAGE_FRACTION;
  const maxH = page.height * MAX_IMAGE_FRACTION;
  const k = Math.min(1, maxW / naturalSize.width, maxH / naturalSize.height);
  const w = Math.max(8, naturalSize.width * k);
  const h = Math.max(8, naturalSize.height * k);
  const center = options.at ?? { x: page.width / 2, y: page.height / 2 };
  return {
    id: createId('an'),
    pageId: page.id,
    type: 'image',
    x: center.x - w / 2,
    y: center.y - h / 2,
    w,
    h,
    opacity: 1,
    src,
    isSignature: options.isSignature ?? false,
  };
}

/**
 * Sello centrado en el tercio superior de la página.
 * @param measureLabel Ancho del texto del sello a un tamaño dado (depende del navegador).
 */
export function createStamp(
  page: PageRef,
  label: string,
  color: string,
  measureLabel: (fontSize: number) => number,
): StampAnnotation {
  const h = STAMP_HEIGHT;
  const w = Math.max(STAMP_MIN_WIDTH, measureLabel(h * STAMP_TEXT_RATIO) / 0.8 + 6);
  return {
    id: createId('an'),
    pageId: page.id,
    type: 'stamp',
    x: page.width / 2 - w / 2,
    y: page.height / 3,
    w,
    h,
    opacity: 0.9,
    label,
    color,
  };
}
