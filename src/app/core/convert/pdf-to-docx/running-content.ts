import type { Rect } from '@core/models';
import type { PageContent, PageImage, StyledLine, StyledRun } from './layout.model';

/** Franja superior e inferior de la página donde se buscan cabeceras y pies. */
const EDGE = 0.15;
/** Tolerancia, en puntos, para considerar que dos elementos están en el mismo sitio. */
const SAME_POSITION = 6;
const SAME_SIZE = 3;
/**
 * Con una sola página no hay repetición que lo confirme: el pie tiene que estar muy cerca del
 * borde y bien separado del texto, para no llevarse el título o la última línea del cuerpo.
 */
const SINGLE_PAGE_EDGE = 0.08;
const MIN_SINGLE_PAGE_GAP = 24;

/** "3", "- 3 -", "Página 3", "Page 3 of 10", "3 / 10"… */
export const PAGE_NUMBER =
  /^\s*(?:(?:p[áa]g(?:ina)?\.?|page|p\.)\s*)?[-–—]?\s*\d{1,4}\s*(?:(?:de|of|\/)\s*\d{1,4})?\s*[-–—]?\s*$/i;

type Zone = 'header' | 'footer';
type Element = StyledLine | PageImage;

/** La cabecera o el pie, tal y como están en una de las páginas. */
export interface RunningPart {
  /** Solo los elementos de la cabecera o del pie, con las medidas de su página. */
  readonly page: PageContent;
  readonly top: number;
  readonly bottom: number;
}

export interface RunningContent {
  /** Las páginas sin la cabecera ni el pie. */
  readonly bodies: PageContent[];
  readonly header: RunningPart | null;
  readonly footer: RunningPart | null;
  /** La primera página no tiene cabecera ni pie, aunque las demás sí. */
  readonly titlePage: boolean;
  readonly firstPageNumber: number;
}

interface Match {
  readonly pageIndex: number;
  readonly element: Element;
}

/**
 * Separa la cabecera y el pie del cuerpo de las páginas. Son los elementos de las franjas superior
 * e inferior que se repiten en el mismo sitio en al menos la mitad de las páginas (con una sola
 * página, los que están bien separados del texto). Los números que avanzan con la página se
 * convierten en campos de número de página y de total de páginas.
 */
export function extractRunningContent(pages: readonly PageContent[]): RunningContent {
  const matches = findRunning(pages);
  const isRunning = (element: Element) => matches.has(element);
  const bodies = pages.map((page) => ({
    ...page,
    lines: page.lines.filter((l) => !isRunning(l)),
    images: page.images.filter((i) => !isRunning(i)),
  }));

  let firstPageNumber = 1;
  const part = (zone: Zone): RunningPart | null => {
    const index = pages.findIndex((page) =>
      elementsOf(page).some((e) => isRunning(e) && zoneOf(e, page) === zone),
    );
    if (index < 0) return null;
    const page = pages[index];
    const inZone = (e: Element) => isRunning(e) && zoneOf(e, page) === zone;
    const lines = page.lines.filter(inZone).map((line) => {
      const fields = pageFields(line, matches.get(line) ?? [], pages.length);
      if (fields.firstPageNumber !== null) firstPageNumber = fields.firstPageNumber;
      return withFields(line, fields.byIndex);
    });
    // Una franja o un fondo con texto encima: se queda el texto, que es lo que se edita
    const images = page.images
      .filter(inZone)
      .filter((image) => !lines.some((line) => containsCenter(image, line)));
    const boxes: Rect[] = [...lines, ...images];
    return {
      page: { ...page, lines, images },
      top: Math.min(...boxes.map((b) => b.y)),
      bottom: Math.max(...boxes.map((b) => b.y + b.h)),
    };
  };

  const header = part('header');
  const footer = part('footer');
  const titlePage =
    pages.length > 1 && !!(header || footer) && !elementsOf(pages[0]).some(isRunning);
  return { bodies, header, footer, titlePage, firstPageNumber };
}

/** Elementos de cabecera o pie y, de cada uno, dónde aparece (incluida su propia página). */
function findRunning(pages: readonly PageContent[]): Map<Element, Match[]> {
  const running = new Map<Element, Match[]>();
  const edges = pages.map((page) => elementsOf(page).filter((e) => zoneOf(e, page)));

  if (pages.length === 1) {
    for (const zone of ['header', 'footer'] as const) {
      const group = separatedGroup(pages[0], zone);
      for (const element of group) running.set(element, [{ pageIndex: 0, element }]);
    }
    return running;
  }

  const needed = Math.max(2, Math.ceil(pages.length / 2));
  edges.forEach((elements, i) => {
    for (const element of elements) {
      const found: Match[] = [];
      edges.forEach((others, j) => {
        const match = others.find((other) => sameElement(element, pages[i], other, pages[j]));
        if (match) found.push({ pageIndex: j, element: match });
      });
      if (found.length >= needed) running.set(element, found);
    }
  });
  return running;
}

/** Con una sola página: los elementos de la franja, si hay texto y un buen hueco entre ambos. */
function separatedGroup(page: PageContent, zone: Zone): Element[] {
  const elements = elementsOf(page);
  const group = elements.filter((e) => zoneOf(e, page, SINGLE_PAGE_EDGE) === zone);
  const body = elements.filter((e) => !zoneOf(e, page, SINGLE_PAGE_EDGE));
  if (!group.length || !body.length) return [];
  const gap =
    zone === 'footer'
      ? Math.min(...group.map((e) => e.y)) - Math.max(...body.map((e) => e.y + e.h))
      : Math.min(...body.map((e) => e.y)) - Math.max(...group.map((e) => e.y + e.h));
  return gap >= MIN_SINGLE_PAGE_GAP ? group : [];
}

function zoneOf(element: Rect, page: PageContent, edge = EDGE): Zone | null {
  if (element.y + element.h <= page.height * edge) return 'header';
  if (element.y >= page.height * (1 - edge)) return 'footer';
  return null;
}

/** El mismo texto (salvo los números) o la misma imagen, en el mismo sitio de la página. */
function sameElement(a: Element, pageA: PageContent, b: Element, pageB: PageContent): boolean {
  const zone = zoneOf(a, pageA);
  if (zone !== zoneOf(b, pageB)) return false;
  // Los pies se miden desde abajo, por si las páginas tienen alturas distintas
  const offset = zone === 'footer' ? pageA.height - pageB.height : 0;
  if (Math.abs(a.y - (b.y + offset)) > SAME_POSITION) return false;
  if (isLine(a) && isLine(b)) return withoutNumbers(textOf(a)) === withoutNumbers(textOf(b));
  if (isLine(a) || isLine(b)) return false;
  return (
    Math.abs(a.x - b.x) <= SAME_POSITION &&
    Math.abs(a.w - b.w) <= SAME_SIZE &&
    Math.abs(a.h - b.h) <= SAME_SIZE
  );
}

/**
 * Qué números de la línea son campos. Es número de página si avanza a la vez que la página (con
 * un desfase fijo, por si la portada no cuenta) y total de páginas si coincide con el total.
 */
function pageFields(
  line: StyledLine,
  matches: readonly Match[],
  pageCount: number,
): { byIndex: Map<number, 'page' | 'pages'>; firstPageNumber: number | null } {
  const byIndex = new Map<number, 'page' | 'pages'>();
  const lists = matches.map((m) => numbersIn(textOf(m.element as StyledLine)));
  let firstPageNumber: number | null = null;

  numbersIn(textOf(line)).forEach((_, k) => {
    const values = lists.map((list) => list[k]);
    if (values.some((v) => v === undefined)) return;
    const offsets = values.map((v, i) => v - matches[i].pageIndex);
    const advances =
      matches.length > 1
        ? offsets.every((o) => o === offsets[0])
        : PAGE_NUMBER.test(textOf(line)) && offsets[0] === 1;
    if (advances && firstPageNumber === null) {
      byIndex.set(k, 'page');
      firstPageNumber = offsets[0];
    }
  });
  numbersIn(textOf(line)).forEach((_, k) => {
    const values = lists.map((list) => list[k]);
    const total = pageCount - 1 + (firstPageNumber ?? 1);
    if (!byIndex.has(k) && byIndex.size && values.every((v) => v === total)) {
      byIndex.set(k, 'pages');
    }
  });
  return { byIndex, firstPageNumber };
}

/** Parte los trozos de la línea para que cada número que es un campo vaya en su propio trozo. */
export function withFields(line: StyledLine, fields: ReadonlyMap<number, 'page' | 'pages'>) {
  if (!fields.size) return line;
  const runs: StyledRun[] = [];
  let k = 0;
  for (const run of line.runs) {
    let from = 0;
    for (const match of run.text.matchAll(/\d+/g)) {
      const field = fields.get(k++);
      if (!field) continue;
      if (match.index > from) runs.push({ ...run, text: run.text.slice(from, match.index) });
      runs.push({ ...run, text: match[0], field });
      from = match.index + match[0].length;
    }
    if (from < run.text.length) runs.push({ ...run, text: run.text.slice(from) });
  }
  return { ...line, runs };
}

const elementsOf = (page: PageContent): Element[] => [...page.lines, ...page.images];

const isLine = (element: Element): element is StyledLine => 'runs' in element;

const textOf = (line: StyledLine): string => line.runs.map((r) => r.text).join('');

const withoutNumbers = (text: string): string =>
  text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

const numbersIn = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number);

const containsCenter = (outer: Rect, inner: Rect): boolean => {
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  return cx > outer.x && cx < outer.x + outer.w && cy > outer.y && cy < outer.y + outer.h;
};
