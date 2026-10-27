import type { PageRef, PathAnnotation, Point, Rect, Rotation, Size } from '@core/models';

/** Tamaño de la página tal y como se ve, con la rotación del usuario aplicada. */
export function displaySize(page: Pick<PageRef, 'width' | 'height' | 'rotation'>): Size {
  return page.rotation % 180
    ? { w: page.height, h: page.width }
    : { w: page.width, h: page.height };
}

/**
 * Convierte un punto de pantalla al espacio base de una página.
 * @param center Centro de la página en pantalla.
 */
export function screenToPage(
  screen: Point,
  center: Point,
  zoom: number,
  rotation: Rotation,
  pageSize: Size,
): Point {
  const dx = (screen.x - center.x) / zoom;
  const dy = (screen.y - center.y) / zoom;
  const t = (-rotation * Math.PI) / 180;
  return {
    x: dx * Math.cos(t) - dy * Math.sin(t) + pageSize.w / 2,
    y: dx * Math.sin(t) + dy * Math.cos(t) + pageSize.h / 2,
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectFromPoints(a: Point, b: Point, square = false): Rect {
  let w = Math.abs(b.x - a.x);
  let h = Math.abs(b.y - a.y);
  if (square) w = h = Math.max(w, h);
  return { x: b.x < a.x ? a.x - w : a.x, y: b.y < a.y ? a.y - h : a.y, w, h };
}

/** Ajusta el segundo punto a múltiplos de 45° respecto al primero. */
export function snapAngle(from: Point, to: Point, stepRad = Math.PI / 4): Point {
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / stepRad) * stepRad;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: from.x + length * Math.cos(angle), y: from.y + length * Math.sin(angle) };
}

type PathGeometry = Pick<PathAnnotation, 'x' | 'y' | 'w' | 'h' | 'points'>;

/** Caja mínima de una lista de puntos y sus coordenadas normalizadas dentro de ella. */
export function normalizePoints(points: readonly Point[]): PathGeometry {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minX = Math.min(...xs);
  let minY = Math.min(...ys);
  let w = Math.max(...xs) - minX;
  let h = Math.max(...ys) - minY;
  if (w < 1) {
    minX -= (1 - w) / 2;
    w = 1;
  }
  if (h < 1) {
    minY -= (1 - h) / 2;
    h = 1;
  }
  return {
    x: minX,
    y: minY,
    w,
    h,
    points: points.map((p) => [(p.x - minX) / w, (p.y - minY) / h] as const),
  };
}

export function absolutePoints(a: PathGeometry): Point[] {
  return a.points.map(([px, py]) => ({ x: a.x + px * a.w, y: a.y + py * a.h }));
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * Calcula la nueva caja al arrastrar un tirador.
 * @param keepRatio Mantener la proporción (solo en las esquinas).
 */
export function resizeRect(
  origin: Rect,
  handle: ResizeHandle,
  delta: Point,
  keepRatio: boolean,
  minSize = 4,
): Rect {
  let { x, y, w, h } = origin;
  if (handle.includes('e')) w = origin.w + delta.x;
  if (handle.includes('s')) h = origin.h + delta.y;
  if (handle.includes('w')) {
    w = origin.w - delta.x;
    x = origin.x + delta.x;
  }
  if (handle.includes('n')) {
    h = origin.h - delta.y;
    y = origin.y + delta.y;
  }
  if (keepRatio && handle.length === 2) {
    const k = Math.max(w / origin.w, h / origin.h);
    w = origin.w * k;
    h = origin.h * k;
    if (handle.includes('w')) x = origin.x + origin.w - w;
    if (handle.includes('n')) y = origin.y + origin.h - h;
  }
  if (w < minSize) {
    if (handle.includes('w')) x -= minSize - w;
    w = minSize;
  }
  if (h < minSize) {
    if (handle.includes('n')) y -= minSize - h;
    h = minSize;
  }
  return { x, y, w, h };
}
