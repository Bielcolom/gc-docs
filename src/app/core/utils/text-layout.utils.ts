import type { RawTextItem, TextLine, TextSegment } from '@core/models';
import { normalizeForSearch } from './text.utils';

/** Tolerancias, en proporción del tamaño de letra. */
const SAME_BASELINE = 0.35;
const SAME_SIZE = 0.25;
const MAX_GAP = 1.2;
const MAX_OVERLAP = 0.5;
const SPACE_GAP = 0.18;

interface MutableLine {
  text: string;
  x: number;
  width: number;
  baseline: number;
  fontSize: number;
  first: RawTextItem;
  segments: TextSegment[];
  end: number;
}

/**
 * Agrupa los elementos de texto de pdf.js en líneas editables: mismo renglón, tamaño parecido
 * y fragmentos próximos entre sí. Las columnas separadas quedan como líneas distintas.
 */
export function groupTextItems(items: readonly RawTextItem[]): TextLine[] {
  const sorted = [...items].sort((a, b) => {
    const dy = a.baseline - b.baseline;
    if (Math.abs(dy) > Math.min(a.fontSize, b.fontSize) * SAME_BASELINE) return dy;
    return a.x - b.x;
  });

  const lines: MutableLine[] = [];
  let current: MutableLine | null = null;

  for (const item of sorted) {
    if (current && belongsToLine(current, item)) {
      const gap = item.x - current.end;
      if (
        gap > current.fontSize * SPACE_GAP &&
        !current.text.endsWith(' ') &&
        !item.text.startsWith(' ')
      ) {
        current.text += ' ';
      }
      const start = current.text.length;
      current.text += item.text;
      current.segments.push({ start, end: current.text.length, x: item.x, width: item.width });
      current.end = Math.max(current.end, item.x + item.width);
      current.width = current.end - current.x;
      current.fontSize = Math.max(current.fontSize, item.fontSize);
    } else {
      current = {
        text: item.text,
        x: item.x,
        width: item.width,
        baseline: item.baseline,
        fontSize: item.fontSize,
        first: item,
        segments: [{ start: 0, end: item.text.length, x: item.x, width: item.width }],
        end: item.x + item.width,
      };
      lines.push(current);
    }
  }

  return lines
    .map((line, i) => {
      const { ascent, descent } = line.first;
      return {
        key: `${i}:${Math.round(line.x)}:${Math.round(line.baseline)}`,
        text: line.text.replace(/\s+$/, ''),
        x: line.x,
        y: line.baseline - ascent * line.fontSize,
        width: line.width,
        height: (ascent + descent) * line.fontSize,
        baseline: line.baseline,
        fontSize: line.fontSize,
        fontName: line.first.fontName,
        fontRealName: line.first.fontRealName,
        fontFamily: line.first.fontFamily,
        segments: line.segments,
      } satisfies TextLine;
    })
    .filter((line) => line.text.length > 0);
}

function belongsToLine(line: MutableLine, item: RawTextItem): boolean {
  const size = Math.min(line.fontSize, item.fontSize);
  const gap = item.x - line.end;
  return (
    Math.abs(line.baseline - item.baseline) < size * SAME_BASELINE &&
    Math.abs(line.fontSize - item.fontSize) < Math.max(line.fontSize, item.fontSize) * SAME_SIZE &&
    gap < line.fontSize * MAX_GAP &&
    gap > -line.fontSize * MAX_OVERLAP
  );
}

/** Coordenada X del carácter `index` de la línea, interpolando dentro de su fragmento. */
export function charX(line: TextLine, index: number): number {
  for (const s of line.segments) {
    if (index >= s.start && index <= s.end) {
      return s.x + (s.width * (index - s.start)) / Math.max(1, s.end - s.start);
    }
  }
  return index <= 0 ? line.x : line.x + line.width;
}

export interface LineMatch {
  readonly start: number;
  readonly end: number;
  readonly x: number;
  readonly width: number;
}

/** Coincidencias de `query` en una línea, sin distinguir mayúsculas ni tildes. */
export function findInLine(line: TextLine, query: string): LineMatch[] {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return [];
  const haystack = normalizeForSearch(line.text);
  const matches: LineMatch[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    from = at + needle.length;
    const x1 = charX(line, at);
    const x2 = charX(line, from);
    matches.push({ start: at, end: from, x: x1, width: Math.max(2, x2 - x1) });
  }
  return matches;
}
