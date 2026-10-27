import type { Point } from '@core/models';

export interface ItemBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface DropTarget {
  /** Posición de inserción (0..n) en la lista original. */
  readonly index: number;
  /** Elemento junto al que se dibuja el indicador. */
  readonly anchor: number;
  readonly side: 'before' | 'after';
}

/**
 * Posición de inserción dentro de una cuadrícula que se rellena por filas.
 * Devuelve `null` si el puntero está entre filas y no se puede decidir.
 */
export function computeDropTarget(
  boxes: readonly ItemBox[],
  pointer: Point,
  gap: number,
): DropTarget | null {
  if (!boxes.length) return null;
  const row = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) => pointer.y >= box.top - gap / 2 && pointer.y <= box.bottom + gap / 2);

  if (row.length) {
    const hit = row.find(({ box }) => pointer.x < (box.left + box.right) / 2);
    if (hit) return { index: hit.index, anchor: hit.index, side: 'before' };
    const last = row[row.length - 1];
    return { index: last.index + 1, anchor: last.index, side: 'after' };
  }
  const lastIndex = boxes.length - 1;
  if (pointer.y > boxes[lastIndex].bottom)
    return { index: boxes.length, anchor: lastIndex, side: 'after' };
  if (pointer.y < boxes[0].top) return { index: 0, anchor: 0, side: 'before' };
  return null;
}
