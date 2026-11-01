import type { PageContent, PageImage, StyledLine } from './layout.model';
import { extractRunningContent } from './running-content';

const HEIGHT = 800;

const line = (text: string, x: number, top: number): StyledLine => ({
  x,
  y: top,
  w: text.length * 5,
  h: 10,
  baseline: top + 8,
  fontSize: 10,
  runs: [{ text, fontSize: 10, font: 'Arial', bold: false, italic: false, color: '000000' }],
});

const image = (x: number, y: number, w: number, h: number): PageImage => ({
  x,
  y,
  w,
  h,
  data: new Uint8Array([1]),
});

const page = (lines: StyledLine[], images: PageImage[] = []): PageContent => ({
  width: 600,
  height: HEIGHT,
  lines,
  images,
});

const body = (n: number) => line(`Texto distinto de la página ${n}`, 50, 300);

/** Página `n` (desde 1) de un documento de `total` con logo en la cabecera y pie numerado. */
const numbered = (n: number, total: number) =>
  page(
    [line('ACME · Informe anual', 120, 40), body(n), line(`Página ${n} de ${total}`, 450, 770)],
    [image(50, 30, 60, 30)],
  );

const texts = (p: PageContent | undefined) =>
  p?.lines.map((l) => l.runs.map((r) => r.text).join(''));

describe('extractRunningContent', () => {
  it('saca del cuerpo la cabecera y el pie que se repiten', () => {
    const result = extractRunningContent([1, 2, 3].map((n) => numbered(n, 3)));
    expect(result.bodies.map((b) => texts(b))).toEqual([
      ['Texto distinto de la página 1'],
      ['Texto distinto de la página 2'],
      ['Texto distinto de la página 3'],
    ]);
    expect(result.bodies.every((b) => !b.images.length)).toBe(true);
    expect(texts(result.header?.page)).toEqual(['ACME · Informe anual']);
    expect(result.header?.page.images).toHaveLength(1);
    expect(result.titlePage).toBe(false);
  });

  it('convierte el número de página y el total en campos', () => {
    const result = extractRunningContent([1, 2, 3].map((n) => numbered(n, 3)));
    const runs = result.footer?.page.lines[0].runs ?? [];
    expect(runs.map((r) => [r.text, r.field])).toEqual([
      ['Página ', undefined],
      ['1', 'page'],
      [' de ', undefined],
      ['3', 'pages'],
    ]);
    expect(result.firstPageNumber).toBe(1);
  });

  it('deja la portada sin cabecera ni pie y respeta dónde empieza la numeración', () => {
    // La portada no cuenta: la página 2 del PDF muestra "1"
    const cover = page([line('Portada', 200, 400)]);
    const rest = [2, 3, 4].map((n) => page([body(n), line(`- ${n - 1} -`, 290, 770)]));
    const result = extractRunningContent([cover, ...rest]);
    expect(result.titlePage).toBe(true);
    expect(result.firstPageNumber).toBe(0);
    expect(result.footer?.page.lines[0].runs.map((r) => r.field)).toEqual([
      undefined,
      'page',
      undefined,
    ]);
  });

  it('no confunde con un pie el texto del final de página que cambia en cada una', () => {
    const endings = ['Fin del capítulo uno.', 'Sigue el dos.', 'Y aquí el tres.'];
    const result = extractRunningContent(
      endings.map((text, i) => page([body(i + 1), line(text, 50, 720)])),
    );
    expect(result.footer).toBeNull();
    expect(result.bodies.every((b) => b.lines.length === 2)).toBe(true);
  });

  it('con una franja detrás del pie, conserva el texto y quita la franja', () => {
    const pages = [1, 2].map((n) =>
      page([body(n), line('Documento confidencial', 220, 760)], [image(0, 750, 600, 30)]),
    );
    const result = extractRunningContent(pages);
    expect(texts(result.footer?.page)).toEqual(['Documento confidencial']);
    expect(result.footer?.page.images).toHaveLength(0);
  });

  it('en un documento de una página, solo es pie lo que está separado del texto', () => {
    const separated = extractRunningContent([
      page([line('Cuerpo', 50, 300), line('Calle Mayor 1 · 28001 Madrid', 50, 770)]),
    ]);
    expect(texts(separated.footer?.page)).toEqual(['Calle Mayor 1 · 28001 Madrid']);

    const continuous = extractRunningContent([
      page([line('Penúltima línea', 50, 676), line('Última línea del cuerpo', 50, 690)]),
    ]);
    expect(continuous.footer).toBeNull();
  });
});
