import type { Point } from '@core/models';

type Pt = readonly [number, number];

const fmt = (n: number): string => n.toFixed(2);

/** Trazo suavizado con curvas cuadráticas entre puntos consecutivos. */
export function smoothPath(points: readonly Pt[]): string {
  if (!points.length) return '';
  if (points.length < 3) return 'M' + points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L');
  let d = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) / 2;
    const my = (points[i][1] + points[i + 1][1]) / 2;
    d += ` Q${fmt(points[i][0])} ${fmt(points[i][1])} ${fmt(mx)} ${fmt(my)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${fmt(last[0])} ${fmt(last[1])}`;
}

export function linePath(from: Pt, to: Pt): string {
  return `M${fmt(from[0])} ${fmt(from[1])} L${fmt(to[0])} ${fmt(to[1])}`;
}

export function polylinePath(points: readonly Pt[], closed = false): string {
  return 'M' + points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L') + (closed ? ' Z' : '');
}

export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): string {
  const r = Math.min(radius, w / 2, h / 2);
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `Q${x + w} ${y} ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `Q${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `Q${x} ${y + h} ${x} ${y + h - r}`,
    `V${y + r}`,
    `Q${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

/** Vértices de la punta de una flecha que va de `from` a `to`. */
export function arrowHead(from: Point, to: Point, strokeWidth: number): [Pt, Pt, Pt] {
  const length = Math.max(9, strokeWidth * 4);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  return [
    [to.x, to.y],
    [to.x - length * Math.cos(angle - spread), to.y - length * Math.sin(angle - spread)],
    [to.x - length * Math.cos(angle + spread), to.y - length * Math.sin(angle + spread)],
  ];
}

/** Trazos normalizados (0..1) de las marcas de formulario. */
export const SYMBOL_STROKES: Readonly<Record<'check' | 'cross', readonly (readonly Pt[])[]>> = {
  check: [
    [
      [0.14, 0.54],
      [0.4, 0.8],
      [0.88, 0.2],
    ],
  ],
  cross: [
    [
      [0.18, 0.18],
      [0.82, 0.82],
    ],
    [
      [0.82, 0.18],
      [0.18, 0.82],
    ],
  ],
};
