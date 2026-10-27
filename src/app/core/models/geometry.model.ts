export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

/** Rectángulo en puntos PDF con origen arriba a la izquierda. */
export interface Rect extends Point, Size {}

/** Rotación en grados en el sentido de las agujas del reloj. */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Matriz afín `[a, b, c, d, e, f]` con la misma convención que PDF y canvas:
 * `x' = a·x + c·y + e` e `y' = b·x + d·y + f`.
 */
export type Matrix = readonly [number, number, number, number, number, number];
