import type { PDFPageProxy } from './pdfjs';
import { Util } from './pdfjs';

export interface TextSegment {
  /** índices dentro de line.str */
  start: number;
  end: number;
  x: number;
  w: number;
}

export interface TextLine {
  key: string;
  str: string;
  x: number;
  /** parte superior de la caja (espacio base) */
  y: number;
  w: number;
  h: number;
  baseline: number;
  size: number;
  fontName: string;
  /** nombre real de la fuente (p.ej. "ABCDEF+Arial-BoldMT") si se conoce */
  fontRealName: string;
  fontFamily: string;
  ascent: number;
  descent: number;
  segments: TextSegment[];
}

interface RawItem {
  str: string;
  x: number;
  baseline: number;
  w: number;
  size: number;
  fontName: string;
  ascent: number;
  descent: number;
  family: string;
  eol: boolean;
}

const cache = new WeakMap<PDFPageProxy, Promise<TextLine[]>>();

export function getTextLines(page: PDFPageProxy, vt: number[]): Promise<TextLine[]> {
  let p = cache.get(page);
  if (!p) {
    p = extract(page, vt);
    cache.set(page, p);
  }
  return p;
}

function fontRealName(page: PDFPageProxy, fontName: string): string {
  try {
    const objs: any = (page as any).commonObjs;
    if (objs?.has?.(fontName)) {
      const f = objs.get(fontName);
      return String(f?.name ?? '');
    }
  } catch {
    /* fuente aún no cargada */
  }
  return '';
}

async function extract(page: PDFPageProxy, vt: number[]): Promise<TextLine[]> {
  const content = await page.getTextContent();
  const styles: Record<string, any> = (content as any).styles ?? {};
  const raw: RawItem[] = [];
  for (const it of content.items as any[]) {
    if (typeof it.str !== 'string') continue;
    if (!it.str.trim() && !it.hasEOL) {
      if (it.str.length && raw.length) raw[raw.length - 1].str += it.str;
      continue;
    }
    const tx = Util.transform(vt, it.transform);
    // solo texto horizontal
    if (Math.abs(tx[1]) > 0.01 * Math.abs(tx[0]) + 1e-6 || tx[0] <= 0) continue;
    const size = Math.hypot(tx[2], tx[3]);
    if (!size || !it.str.trim()) {
      continue;
    }
    const st = styles[it.fontName] ?? {};
    const scaleX = Math.hypot(vt[0], vt[1]);
    raw.push({
      str: it.str,
      x: tx[4],
      baseline: tx[5],
      w: it.width * scaleX,
      size,
      fontName: it.fontName,
      ascent: st.ascent && st.ascent > 0.2 ? st.ascent : 0.8,
      descent: st.descent ? Math.abs(st.descent) : 0.2,
      family: st.fontFamily ?? 'sans-serif',
      eol: !!it.hasEOL,
    });
  }

  // Agrupar en líneas: misma línea base, mismo tamaño y fragmentos cercanos.
  const order = raw.map((_, i) => i).sort((a, b) => {
    const ra = raw[a];
    const rb = raw[b];
    const dy = ra.baseline - rb.baseline;
    if (Math.abs(dy) > Math.min(ra.size, rb.size) * 0.35) return dy;
    return ra.x - rb.x;
  });

  const lines: TextLine[] = [];
  let cur: TextLine | null = null;
  let curEnd = 0;
  for (const idx of order) {
    const r = raw[idx];
    const sameLine =
      cur &&
      Math.abs(cur.baseline - r.baseline) < Math.min(cur.size, r.size) * 0.35 &&
      Math.abs(cur.size - r.size) < Math.max(cur.size, r.size) * 0.25 &&
      r.x - curEnd < cur.size * 1.2 &&
      r.x - curEnd > -cur.size * 0.5;
    if (cur && sameLine) {
      const gap = r.x - curEnd;
      if (gap > cur.size * 0.18 && !cur.str.endsWith(' ') && !r.str.startsWith(' ')) cur.str += ' ';
      const start = cur.str.length;
      cur.str += r.str;
      cur.segments.push({ start, end: cur.str.length, x: r.x, w: r.w });
      curEnd = Math.max(curEnd, r.x + r.w);
      cur.w = curEnd - cur.x;
      cur.size = Math.max(cur.size, r.size);
    } else {
      if (cur) lines.push(cur);
      cur = {
        key: '',
        str: r.str,
        x: r.x,
        y: 0,
        w: r.w,
        h: 0,
        baseline: r.baseline,
        size: r.size,
        fontName: r.fontName,
        fontRealName: fontRealName(page, r.fontName),
        fontFamily: r.family,
        ascent: r.ascent,
        descent: r.descent,
        segments: [{ start: 0, end: r.str.length, x: r.x, w: r.w }],
      };
      curEnd = r.x + r.w;
    }
  }
  if (cur) lines.push(cur);

  lines.forEach((l, i) => {
    l.str = l.str.replace(/\s+$/, '');
    l.y = l.baseline - l.ascent * l.size;
    l.h = (l.ascent + l.descent) * l.size;
    l.key = `${i}:${Math.round(l.x)}:${Math.round(l.baseline)}`;
  });
  return lines.filter((l) => l.str.length > 0);
}

/** Normaliza para buscar sin distinguir mayúsculas ni tildes (mantiene la longitud). */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '') || c)
    .map((c) => (c.length === 1 ? c : c[0]))
    .join('');
}
