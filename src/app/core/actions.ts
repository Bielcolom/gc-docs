import { DocumentStore } from './document.store';
import { Annot, PageRef, PathAnnot, TextAnnot } from './models';
import { uid } from './util';

/** Página visible ahora mismo. */
export function currentPageRef(store: DocumentStore): PageRef | undefined {
  const pages = store.pages();
  return pages[Math.min(store.currentPage(), pages.length - 1)];
}

export function placeImage(
  store: DocumentStore,
  page: PageRef,
  src: string,
  natW: number,
  natH: number,
  opts: { at?: { x: number; y: number }; maxFrac?: number; isSignature?: boolean } = {},
): void {
  const maxW = page.w * (opts.maxFrac ?? 0.45);
  const maxH = page.h * (opts.maxFrac ?? 0.45);
  const k = Math.min(1, maxW / natW, maxH / natH);
  const w = Math.max(8, natW * k);
  const h = Math.max(8, natH * k);
  const cx = opts.at?.x ?? page.w / 2;
  const cy = opts.at?.y ?? page.h / 2;
  store.addAnnot({
    id: uid('an'),
    pageId: page.id,
    type: 'image',
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    opacity: 1,
    src,
    isSignature: opts.isSignature,
  });
  store.tool.set('select');
}

const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function measureText(text: string, css: string, size: number, bold = false): number {
  const ctx = measureCanvas?.getContext('2d');
  if (!ctx) return text.length * size * 0.55;
  ctx.font = `${bold ? '700' : '400'} ${size}px ${css}`;
  return ctx.measureText(text).width;
}

export function placeStamp(store: DocumentStore, page: PageRef, label: string, color: string): void {
  const h = 34;
  const w = Math.max(80, measureText(label, 'Helvetica, Arial, sans-serif', h * 0.46, true) / 0.8 + 6);
  store.addAnnot({
    id: uid('an'),
    pageId: page.id,
    type: 'stamp',
    x: page.w / 2 - w / 2,
    y: page.h / 3,
    w,
    h,
    opacity: 0.9,
    label,
    color,
  });
  store.tool.set('select');
}

/** Normaliza una lista de puntos absolutos a caja + puntos relativos. */
export function normalizePoints(pts: [number, number][]): Pick<PathAnnot, 'x' | 'y' | 'w' | 'h' | 'points'> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  let w = maxX - minX;
  let h = maxY - minY;
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
    points: pts.map(([x, y]) => [(x - minX) / w, (y - minY) / h]),
  };
}

export function absolutePoints(a: PathAnnot): [number, number][] {
  return a.points.map(([px, py]) => [a.x + px * a.w, a.y + py * a.h]);
}

export function isTextAnnot(a: Annot | null | undefined): a is TextAnnot {
  return !!a && a.type === 'text';
}

export const STAMPS: { label: string; color: string }[] = [
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
];

export const HIGHLIGHT_COLORS = ['#ffe14d', '#9cf08c', '#7fd8ff', '#ffa8d5', '#ffb86b'];
