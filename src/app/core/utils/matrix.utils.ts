import type { Matrix, Point, Rotation } from '@core/models';

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Composición `m1 ∘ m2`: primero se aplica `m2` y después `m1`. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  if (det === 0) throw new Error('La matriz no es invertible');
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** Invierte el eje Y en un espacio de altura `height` (de "y hacia abajo" a "y hacia arriba"). */
export function flipY(height: number): Matrix {
  return [1, 0, 0, -1, 0, height];
}

/**
 * Pasa del espacio "tal y como se ve" (página girada por el usuario) al espacio base,
 * ambos con el eje Y hacia abajo. `width` y `height` son las medidas del espacio base.
 */
export function baseFromDisplay(rotation: Rotation, width: number, height: number): Matrix {
  switch (rotation) {
    case 90:
      return [0, -1, 1, 0, 0, height];
    case 180:
      return [-1, 0, 0, -1, width, height];
    case 270:
      return [0, 1, -1, 0, width, 0];
    default:
      return IDENTITY;
  }
}
