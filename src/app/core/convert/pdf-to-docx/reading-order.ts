import type { Rect } from '@core/models';

/** Lo mínimo que necesita el orden de lectura de una línea o una imagen. */
export interface LayoutBox extends Rect {
  readonly baseline: number;
  readonly fontSize: number;
}

/** Límites horizontales de la columna en la que cae una caja. */
export interface Column {
  readonly left: number;
  readonly right: number;
  /** `true` si la columna sale de dividir la página en vertical (no es la página entera). */
  readonly nested: boolean;
}

export interface OrderedBox<T extends LayoutBox> {
  readonly box: T;
  readonly column: Column;
}

/** Hueco mínimo entre columnas, en proporción del tamaño de letra mediano. */
const MIN_GUTTER = 1.2;
/** Dos líneas están en el mismo renglón si sus líneas base distan menos que esto × tamaño. */
const SAME_BASELINE = 0.35;
/** Proporción de renglones alineados a partir de la cual dos bloques parecen una tabla. */
const TABLE_ALIGNMENT = 0.5;
/** Las columnas de texto tienen líneas largas: al menos esta proporción del ancho total. */
const COLUMN_LINE_WIDTH = 0.3;
const MIN_COLUMN_LINES = 4;

interface Gap {
  /** Coordenada en la que se corta. */
  readonly at: number;
  readonly size: number;
}

/**
 * Ordena las cajas de una página tal y como se leen, con un corte XY recursivo: en cada paso se
 * parte por el hueco más ancho, horizontal (entre bloques) o vertical (entre columnas). Así un
 * documento a dos columnas se lee columna a columna, y una tabla, fila a fila.
 */
export function readingOrder<T extends LayoutBox>(boxes: readonly T[]): OrderedBox<T>[] {
  if (!boxes.length) return [];
  const fontSize = median(boxes.map((b) => b.fontSize));
  const page: Column = { ...bounds(boxes), nested: false };
  return cut(boxes, fontSize, page);
}

function cut<T extends LayoutBox>(
  boxes: readonly T[],
  fontSize: number,
  column: Column,
): OrderedBox<T>[] {
  if (boxes.length <= 1) return boxes.map((box) => ({ box, column }));

  const horizontal = widest(
    gaps(
      boxes,
      (b) => b.y,
      (b) => b.y + b.h,
    ),
  );
  const vertical = widest(
    gaps(
      boxes,
      (b) => b.x,
      (b) => b.x + b.w,
    ).filter((gap) => gap.size >= fontSize * MIN_GUTTER && isColumnSplit(boxes, gap, fontSize)),
  );

  if (vertical && (!horizontal || vertical.size > horizontal.size)) {
    const left = boxes.filter((b) => b.x < vertical.at);
    const right = boxes.filter((b) => b.x >= vertical.at);
    return [
      ...cut(left, fontSize, { ...bounds(left), nested: true }),
      ...cut(right, fontSize, { ...bounds(right), nested: true }),
    ];
  }
  if (horizontal) {
    return [
      ...cut(
        boxes.filter((b) => b.y < horizontal.at),
        fontSize,
        column,
      ),
      ...cut(
        boxes.filter((b) => b.y >= horizontal.at),
        fontSize,
        column,
      ),
    ];
  }
  return [...boxes].sort(byRow).map((box) => ({ box, column }));
}

/** Renglón a renglón y, dentro del renglón, de izquierda a derecha. */
export function byRow(a: LayoutBox, b: LayoutBox): number {
  const dy = a.baseline - b.baseline;
  if (!sameRow(a, b)) return dy;
  return a.x - b.x;
}

export function sameRow(a: LayoutBox, b: LayoutBox): boolean {
  return Math.abs(a.baseline - b.baseline) <= Math.min(a.fontSize, b.fontSize) * SAME_BASELINE;
}

/**
 * Un hueco vertical separa columnas de texto si los renglones de los dos lados no coinciden
 * (cada columna fluye por su cuenta) o si, aun coincidiendo, los dos lados tienen líneas largas.
 * Si no, es una tabla o un formulario y se lee por filas.
 */
function isColumnSplit(boxes: readonly LayoutBox[], gap: Gap, fontSize: number): boolean {
  const left = boxes.filter((b) => b.x < gap.at);
  const right = boxes.filter((b) => b.x >= gap.at);
  if (left.length < 2 || right.length < 2) return false;

  const aligned = left.filter((l) =>
    right.some((r) => Math.abs(l.baseline - r.baseline) < fontSize * SAME_BASELINE),
  ).length;
  if (aligned / left.length < TABLE_ALIGNMENT) return true;

  const { left: x0, right: x1 } = bounds(boxes);
  const minWidth = (x1 - x0) * COLUMN_LINE_WIDTH;
  return (
    left.length >= MIN_COLUMN_LINES &&
    right.length >= MIN_COLUMN_LINES &&
    median(left.map((b) => b.w)) >= minWidth &&
    median(right.map((b) => b.w)) >= minWidth
  );
}

/** Huecos de la proyección de las cajas sobre un eje. */
function gaps<T>(boxes: readonly T[], start: (b: T) => number, end: (b: T) => number): Gap[] {
  const spans = boxes.map((b) => [start(b), end(b)] as const).sort((a, b) => a[0] - b[0]);
  const result: Gap[] = [];
  let reach = spans[0][1];
  for (const [from, to] of spans.slice(1)) {
    if (from > reach) result.push({ at: (reach + from) / 2, size: from - reach });
    reach = Math.max(reach, to);
  }
  return result;
}

function widest(list: readonly Gap[]): Gap | null {
  return list.reduce<Gap | null>((best, gap) => (!best || gap.size > best.size ? gap : best), null);
}

function bounds(boxes: readonly Rect[]): { left: number; right: number } {
  return {
    left: Math.min(...boxes.map((b) => b.x)),
    right: Math.max(...boxes.map((b) => b.x + b.w)),
  };
}

export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
