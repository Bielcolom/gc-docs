import type { Rect } from '@core/models';
import { clamp } from '@core/utils';
import type {
  Block,
  DocumentLayout,
  ImageBlock,
  Margins,
  PageContent,
  PageImage,
  ParagraphBlock,
  ParagraphRun,
  StyledLine,
  StyledRun,
  TextAlign,
} from './layout.model';
import {
  median,
  readingOrder,
  sameRow,
  type Column,
  type LayoutBox,
  type OrderedBox,
} from './reading-order';
import { PAGE_NUMBER, extractRunningContent, type RunningPart } from './running-content';

/** Tolerancias en proporción del tamaño de letra, salvo que se diga otra cosa. */
const MAX_LINE_GAP = 0.8;
const SAME_SIZE = 0.15;
const SAME_PITCH = 0.3;
const SAME_LEFT = 0.8;
const MAX_FIRST_LINE_INDENT = 8;
const MAX_HANGING_INDENT = 4;
const JUSTIFIED_SPREAD = 0.15;
const CENTER_TOLERANCE = 1.5;
/** Un título es al menos un 25 % más grande que el texto normal y es corto. */
const HEADING_RATIO = 1.25;
const HEADING_MAX_CHARS = 200;
/** Interlineado sencillo de Google Docs respecto al tamaño de letra. */
const SINGLE_LINE_HEIGHT = 1.15;
/** Más espacio que esto empujaría el texto a otra página en Docs. */
const MAX_SPACE_BEFORE = 150;
/** Márgenes de página, en puntos. */
const MIN_MARGIN = 14;
/** El margen inferior se limita para dar holgura: en Docs el texto ocupa algo más que en el PDF. */
const MAX_BOTTOM_MARGIN = 36;
/** Una imagen que tapa casi toda la página es un fondo (o un escaneo). */
const BACKGROUND_COVERAGE = 0.85;

/** Distancia por defecto del borde a la cabecera y al pie, en puntos. */
const HEADER_DISTANCE = 36;
/** Separación mínima entre la cabecera (o el pie) y el texto. */
const HEADER_GAP = 6;

const DEFAULT_MARGINS: Margins = {
  top: 72,
  right: 72,
  bottom: 72,
  left: 72,
  header: HEADER_DISTANCE,
  footer: HEADER_DISTANCE,
};

const BULLET = /^\s*([•●○◦▪▫■□‣⁃∙·*–-]|\d{1,3}[.)]|[a-zA-Z][.)])\s/;
/** Franja superior e inferior de la página donde están las cabeceras y los pies. */
const PAGE_EDGE = 0.1;

type Item =
  | (LayoutBox & { readonly kind: 'line'; readonly line: StyledLine })
  | (LayoutBox & { readonly kind: 'image'; readonly image: PageImage });

/** Una línea de texto con la columna en la que está. */
interface PlacedLine {
  readonly line: StyledLine;
  readonly column: Column;
}

type Placed = PlacedLine | { readonly image: PageImage; readonly column: Column };

/** Convierte las páginas leídas del PDF en el documento listo para escribir. */
export function buildLayout(pages: readonly PageContent[]): DocumentLayout {
  const running = extractRunningContent(pages);
  const cleaned = running.bodies.map(cleanPage);
  const { width: pageWidth, height: pageHeight } = mostCommonSize(cleaned);
  const margins = withRoomFor(
    documentMargins(cleaned, pageWidth, pageHeight),
    running.header,
    running.footer,
  );
  const laidOut = cleaned.map((page) => layoutPage(page, margins, pageWidth));
  const runningBlocks = (part: RunningPart | null) =>
    part ? layoutPage(part.page, margins, pageWidth, part.top) : [];
  return {
    pageWidth,
    pageHeight,
    margins,
    pages: markHeadings(laidOut),
    header: runningBlocks(running.header),
    footer: runningBlocks(running.footer),
    titlePage: running.titlePage,
    firstPageNumber: running.firstPageNumber,
  };
}

/**
 * Coloca la cabecera y el pie a la misma distancia del borde que en el PDF y aparta el texto
 * para que no se monte encima.
 */
function withRoomFor(
  margins: Margins,
  header: RunningPart | null,
  footer: RunningPart | null,
): Margins {
  // El ancho del texto también tiene que abarcar la cabecera y el pie (sus tabuladores)
  const sides = [header, footer].flatMap((part) =>
    part
      ? [...part.page.lines, ...part.page.images].map((b) => ({
          left: b.x,
          right: part.page.width - (b.x + b.w),
        }))
      : [],
  );
  const side = (current: number, values: number[]) =>
    Math.max(MIN_MARGIN, Math.min(current, ...values));
  return {
    ...margins,
    left: side(
      margins.left,
      sides.map((s) => s.left),
    ),
    right: side(
      margins.right,
      sides.map((s) => s.right),
    ),
    header: header ? Math.max(MIN_MARGIN, header.top) : Math.min(margins.top, HEADER_DISTANCE),
    footer: footer
      ? Math.max(MIN_MARGIN, footer.page.height - footer.bottom)
      : Math.min(margins.bottom, HEADER_DISTANCE),
    top: header ? Math.max(margins.top, header.bottom + HEADER_GAP) : margins.top,
    bottom: footer
      ? Math.max(margins.bottom, footer.page.height - footer.top + HEADER_GAP)
      : margins.bottom,
  };
}

/** `true` si la página no tiene texto y es una única imagen grande: un escaneo. */
export function isScannedPage(page: PageContent): boolean {
  return (
    !page.lines.length && page.images.some((image) => coverage(image, page) > BACKGROUND_COVERAGE)
  );
}

/**
 * Quita lo que sobra en un documento que fluye:
 * - las imágenes de fondo de las páginas con texto (el texto ya va como texto);
 * - el texto que queda dentro de una imagen (ya está en el recorte);
 * - los números de página sueltos que no forman parte de un pie (los del pie pasan a ser campos).
 */
export function cleanPage(page: PageContent): PageContent {
  const images = page.lines.length
    ? page.images.filter((image) => coverage(image, page) <= BACKGROUND_COVERAGE)
    : page.images;
  const lines = page.lines.filter(
    (line) =>
      !images.some((image) => containsCenter(image, line)) && !isPageNumber(line, page.height),
  );
  return { ...page, lines, images };
}

function isPageNumber(line: StyledLine, pageHeight: number): boolean {
  const atEdge = line.y + line.h < pageHeight * PAGE_EDGE || line.y > pageHeight * (1 - PAGE_EDGE);
  return atEdge && PAGE_NUMBER.test(textOf(line));
}

/** @param top Dónde empieza la zona: el margen superior o, para la cabecera y el pie, su borde. */
function layoutPage(
  page: PageContent,
  margins: Margins,
  pageWidth: number,
  top = margins.top,
): Block[] {
  const items: Item[] = [
    ...page.lines.map((line) => ({ ...line, kind: 'line' as const, line })),
    ...page.images.map((image) => ({
      ...image,
      kind: 'image' as const,
      image,
      baseline: image.y,
      fontSize: image.h,
    })),
  ];
  const textArea: Column = {
    left: margins.left,
    right: pageWidth - margins.right,
    nested: false,
  };
  const blocks: Block[] = [];
  let previousBottom = top;
  let paragraph: PlacedLine[] = [];

  const flush = () => {
    if (!paragraph.length) return;
    blocks.push(paragraphBlock(paragraph, textArea, previousBottom));
    previousBottom = bottomOf(paragraph.map((p) => p.line));
    paragraph = [];
  };

  for (const row of rows(readingOrder(items))) {
    const first = row[0];
    if (!('line' in first)) {
      flush();
      blocks.push(imageBlock(first.image, first.column, textArea, previousBottom));
      previousBottom = bottomOf([first.image]);
      continue;
    }
    const cells = row as PlacedLine[];
    if (cells.length > 1) {
      flush();
      blocks.push(rowBlock(cells, textArea, previousBottom));
      previousBottom = bottomOf(cells.map((c) => c.line));
    } else if (paragraph.length && continuesParagraph(paragraph, first)) {
      paragraph.push(first);
    } else {
      flush();
      paragraph = [first];
    }
  }
  flush();
  return blocks;
}

/**
 * Junta en filas las líneas consecutivas del mismo renglón (celdas de una tabla o formulario).
 * Las imágenes van siempre solas.
 */
function rows(ordered: readonly OrderedBox<Item>[]): Placed[][] {
  const result: Placed[][] = [];
  for (const { box: item, column } of ordered) {
    if (item.kind === 'image') {
      result.push([{ image: item.image, column }]);
      continue;
    }
    const row = result.at(-1);
    const last = row?.at(-1);
    const previous = last && 'line' in last ? last.line : null;
    if (row && previous && sameRow(previous, item) && item.x >= previous.x + previous.w) {
      row.push({ line: item.line, column });
    } else {
      result.push([{ line: item.line, column }]);
    }
  }
  return result;
}

/** ¿La línea `next` sigue el párrafo, o empieza uno nuevo? */
function continuesParagraph(paragraph: readonly PlacedLine[], next: PlacedLine): boolean {
  const last = paragraph[paragraph.length - 1];
  const previous = last.line;
  const { line } = next;
  const size = previous.fontSize;

  if (Math.abs(line.fontSize - size) > Math.max(line.fontSize, size) * SAME_SIZE) return false;
  if (BULLET.test(textOf(line))) return false;

  // El párrafo sigue en la columna de al lado: empieza arriba, pegado a su borde izquierdo
  if (next.column !== last.column) {
    return (
      last.column.nested &&
      next.column.nested &&
      line.x - next.column.left < size * SAME_LEFT &&
      isSoftWrap(last, line)
    );
  }

  const lines = paragraph.filter((p) => p.column === last.column).map((p) => p.line);
  if (line.baseline <= previous.baseline) return false;
  if (line.y - (previous.y + previous.h) > size * MAX_LINE_GAP) return false;
  if (lines.length >= 2) {
    const pitch = previous.baseline - lines[lines.length - 2].baseline;
    if (Math.abs(line.baseline - previous.baseline - pitch) > size * SAME_PITCH) return false;
  }
  return alignsWith(lines, line) && isSoftWrap(last, line);
}

/** Salto "blando": la primera palabra de la línea siguiente no cabía al final de la anterior. */
function isSoftWrap(previous: PlacedLine, line: StyledLine): boolean {
  const room = previous.column.right - (previous.line.x + previous.line.w);
  const text = textOf(line);
  const firstWord = text.trimStart().split(/\s/)[0] ?? '';
  const charWidth = line.w / Math.max(1, text.length);
  return (firstWord.length + 1) * charWidth > room - previous.line.fontSize * 0.5;
}

function alignsWith(lines: readonly StyledLine[], line: StyledLine): boolean {
  const first = lines[0];
  const size = first.fontSize;
  if (lines.length >= 2) return Math.abs(line.x - lines[1].x) < size * SAME_LEFT;
  const indent = first.x - line.x;
  if (Math.abs(indent) < size * SAME_LEFT) return true;
  // Sangría de primera línea
  if (indent > 0 && indent < size * MAX_FIRST_LINE_INDENT) return true;
  // Sangría francesa: viñeta en la primera línea y el resto alineado con el texto
  return BULLET.test(textOf(first)) && -indent > 0 && -indent < size * MAX_HANGING_INDENT;
}

function paragraphBlock(
  paragraph: readonly PlacedLine[],
  textArea: Column,
  previousBottom: number,
): ParagraphBlock {
  const lines = paragraph.map((p) => p.line);
  // Posición de cada línea respecto a su columna (un párrafo puede seguir en la de al lado)
  const offsets = paragraph.map((p) => p.line.x - areaOf(p, textArea).left);
  const fontSize = dominantSize(lines.flatMap((l) => l.runs));
  const align = detectAlign(paragraph, textArea);
  const rest = offsets.length > 1 ? Math.min(...offsets.slice(1)) : offsets[0];
  const indented = align === 'left' || align === 'justify';
  const indent = indented ? Math.max(0, rest) : 0;

  return {
    kind: 'paragraph',
    runs: mergeRuns(joinLines(lines)),
    align,
    indent,
    firstLineIndent: indented ? Math.max(0, offsets[0]) - indent : 0,
    spaceBefore: spaceBefore(lines[0], previousBottom),
    lineSpacing: lineSpacing(paragraph),
    tabStops: [],
    heading: 0,
    fontSize,
  };
}

/** Una fila con varias celdas: un párrafo con tabuladores en la posición de cada celda. */
function rowBlock(
  row: readonly PlacedLine[],
  textArea: Column,
  previousBottom: number,
): ParagraphBlock {
  const cells = row.map((r) => r.line);
  const column = row[0].column;
  const left = column.nested ? column.left : textArea.left;
  const runs: ParagraphRun[] = [];
  for (const [i, cell] of cells.entries()) {
    if (i > 0) runs.push({ tab: true });
    runs.push(...cell.runs);
  }
  const top = cells.reduce((a, b) => (b.y < a.y ? b : a));
  return {
    kind: 'paragraph',
    runs: mergeRuns(runs),
    align: 'left',
    indent: Math.max(0, cells[0].x - left),
    firstLineIndent: 0,
    spaceBefore: spaceBefore(top, previousBottom),
    lineSpacing: 1,
    tabStops: cells.slice(1).map((cell) => Math.max(0, cell.x - left)),
    heading: 0,
    fontSize: dominantSize(cells.flatMap((c) => c.runs)),
  };
}

function imageBlock(
  image: PageImage,
  column: Column,
  textArea: Column,
  previousBottom: number,
): ImageBlock {
  const left = column.nested ? column.left : textArea.left;
  const available = textArea.right - textArea.left;
  const k = Math.min(1, available / image.w);
  return {
    kind: 'image',
    data: image.data,
    width: image.w * k,
    height: image.h * k,
    indent: clamp(image.x - left, 0, Math.max(0, available - image.w * k)),
    spaceBefore: clamp(image.y - previousBottom, 0, MAX_SPACE_BEFORE),
  };
}

function detectAlign(paragraph: readonly PlacedLine[], textArea: Column): TextAlign {
  const size = paragraph[0].line.fontSize;
  const placed = paragraph.map((p) => ({ line: p.line, area: areaOf(p, textArea) }));
  // Justificado: todas las líneas menos la última acaban en el borde de su columna
  if (placed.length >= 3) {
    const gaps = placed.slice(0, -1).map(({ line, area }) => area.right - (line.x + line.w));
    if (Math.max(...gaps) - Math.min(...gaps) < size * JUSTIFIED_SPREAD + 1) return 'justify';
  }
  const centered = placed.every(
    ({ line, area }) =>
      Math.abs(line.x + line.w / 2 - (area.left + area.right) / 2) < size * CENTER_TOLERANCE &&
      line.x - area.left > size * 3,
  );
  if (centered) return 'center';
  const rightAligned = placed.every(
    ({ line, area }) =>
      Math.abs(line.x + line.w - area.right) < size &&
      line.x - area.left > (area.right - area.left) * 0.4,
  );
  return rightAligned ? 'right' : 'left';
}

/** Zona de referencia de una línea: su columna o, si no hay columnas, el área de texto. */
function areaOf(placed: PlacedLine, textArea: Column): Column {
  return placed.column.nested ? placed.column : textArea;
}

/** Une las líneas de un párrafo: con un espacio o, si la palabra estaba partida con guion, sin él. */
function joinLines(lines: readonly StyledLine[]): StyledRun[] {
  const runs: StyledRun[] = [];
  for (const line of lines) {
    const last = runs.at(-1);
    const nextText = textOf(line);
    if (last) {
      if (/\p{L}-$/u.test(last.text) && /^\p{Ll}/u.test(nextText)) {
        runs[runs.length - 1] = { ...last, text: last.text.slice(0, -1) };
      } else if (!/\s$/.test(last.text)) {
        runs[runs.length - 1] = { ...last, text: `${last.text} ` };
      }
    }
    runs.push(...line.runs);
  }
  return runs;
}

/** Junta los trozos seguidos con el mismo formato. */
export function mergeRuns(runs: readonly ParagraphRun[]): ParagraphRun[] {
  const result: ParagraphRun[] = [];
  for (const run of runs) {
    const last = result.at(-1);
    if (last && !('tab' in last) && !('tab' in run) && sameStyle(last, run)) {
      result[result.length - 1] = { ...last, text: last.text + run.text };
    } else {
      result.push(run);
    }
  }
  return result;
}

function sameStyle(a: StyledRun, b: StyledRun): boolean {
  return (
    !a.field &&
    !b.field &&
    a.fontSize === b.fontSize &&
    a.font === b.font &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.color === b.color
  );
}

function spaceBefore(first: StyledLine, previousBottom: number): number {
  return clamp(first.y - previousBottom - first.fontSize * 0.15, 0, MAX_SPACE_BEFORE);
}

/** Distancia habitual entre renglones de la misma columna, como múltiplo del sencillo. */
function lineSpacing(paragraph: readonly PlacedLine[]): number {
  const pitches = paragraph
    .slice(1)
    .filter((p, i) => p.column === paragraph[i].column)
    .map((p, i) => p.line.baseline - paragraph[i].line.baseline);
  if (!pitches.length) return 1;
  const size = median(paragraph.map((p) => p.line.fontSize));
  return Math.round(clamp(median(pitches) / (size * SINGLE_LINE_HEIGHT), 1, 2.5) * 20) / 20;
}

/**
 * Marca como títulos los párrafos cortos con letra claramente mayor que la del texto normal.
 * El tamaño más grande es el Título 1, el siguiente el Título 2 y el resto el Título 3.
 */
export function markHeadings(pages: readonly (readonly Block[])[]): Block[][] {
  const paragraphs = pages.flat().filter((b): b is ParagraphBlock => b.kind === 'paragraph');
  const body = dominantSize(paragraphs.flatMap((p) => p.runs));
  const isHeading = (p: ParagraphBlock) =>
    p.fontSize >= body * HEADING_RATIO &&
    !p.tabStops.length &&
    plainText(p).trim().length > 0 &&
    plainText(p).length <= HEADING_MAX_CHARS;
  const sizes = [...new Set(paragraphs.filter(isHeading).map((p) => roundHalf(p.fontSize)))].sort(
    (a, b) => b - a,
  );
  const level = (size: number) => Math.min(3, sizes.indexOf(roundHalf(size)) + 1) as 1 | 2 | 3;
  return pages.map((blocks) =>
    blocks.map((b) =>
      b.kind === 'paragraph' && isHeading(b) ? { ...b, heading: level(b.fontSize) } : b,
    ),
  );
}

/** Tamaño de letra que ocupa más caracteres. */
function dominantSize(runs: readonly ParagraphRun[]): number {
  const counts = new Map<number, number>();
  for (const run of runs) {
    if ('tab' in run) continue;
    const size = roundHalf(run.fontSize);
    counts.set(size, (counts.get(size) ?? 0) + run.text.trim().length);
  }
  let best = 11;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

/** Márgenes comunes a todas las páginas, a partir de lo que ocupa su contenido. */
function documentMargins(pages: readonly PageContent[], width: number, height: number): Margins {
  const extents = pages.flatMap((page) => {
    const boxes: Rect[] = [...page.lines, ...page.images];
    if (!boxes.length) return [];
    return [
      {
        left: Math.min(...boxes.map((b) => b.x)),
        top: Math.min(...boxes.map((b) => b.y)),
        right: page.width - Math.max(...boxes.map((b) => b.x + b.w)),
        bottom: page.height - Math.max(...boxes.map((b) => b.y + b.h)),
      },
    ];
  });
  if (!extents.length) return DEFAULT_MARGINS;
  const margin = (side: 'left' | 'right' | 'top' | 'bottom', max: number) =>
    clamp(Math.min(...extents.map((e) => e[side])), MIN_MARGIN, max);
  return {
    ...DEFAULT_MARGINS,
    left: margin('left', width * 0.3),
    right: margin('right', width * 0.3),
    top: margin('top', height * 0.25),
    bottom: margin('bottom', MAX_BOTTOM_MARGIN),
  };
}

function mostCommonSize(pages: readonly PageContent[]): { width: number; height: number } {
  const counts = new Map<string, { width: number; height: number; count: number }>();
  for (const page of pages) {
    const key = `${Math.round(page.width)}x${Math.round(page.height)}`;
    const entry = counts.get(key) ?? { width: page.width, height: page.height, count: 0 };
    counts.set(key, { ...entry, count: entry.count + 1 });
  }
  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return best ?? { width: 595.28, height: 841.89 };
}

const textOf = (line: StyledLine): string => line.runs.map((r) => r.text).join('');

const plainText = (p: ParagraphBlock): string =>
  p.runs.map((r) => ('tab' in r ? '\t' : r.text)).join('');

const bottomOf = (items: readonly Rect[]): number => Math.max(...items.map((i) => i.y + i.h));

const coverage = (image: Rect, page: PageContent): number =>
  (image.w * image.h) / (page.width * page.height);

const containsCenter = (outer: Rect, inner: Rect): boolean => {
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  return cx > outer.x && cx < outer.x + outer.w && cy > outer.y && cy < outer.y + outer.h;
};

const roundHalf = (value: number): number => Math.round(value * 2) / 2;
