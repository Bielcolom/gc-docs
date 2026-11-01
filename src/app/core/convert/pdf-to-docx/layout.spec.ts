import { buildLayout, isScannedPage, mergeRuns, cleanPage } from './layout';
import type {
  Block,
  PageContent,
  PageImage,
  ParagraphBlock,
  StyledLine,
  StyledRun,
} from './layout.model';

const PAGE = { width: 600, height: 800 };
/** Ancho medio de un carácter de 10 pt en las líneas de prueba. */
const CHAR = 5;

const run = (text: string, overrides: Partial<StyledRun> = {}): StyledRun => ({
  text,
  fontSize: 10,
  font: 'Arial',
  bold: false,
  italic: false,
  color: '000000',
  ...overrides,
});

/** Línea cuya caja empieza en `top`; el ancho sale del número de caracteres. */
const line = (
  text: string,
  x: number,
  top: number,
  options: { size?: number; width?: number; runs?: StyledRun[] } = {},
): StyledLine => {
  const size = options.size ?? 10;
  return {
    x,
    y: top,
    w: options.width ?? text.length * CHAR * (size / 10),
    h: size,
    baseline: top + size * 0.8,
    fontSize: size,
    runs: options.runs ?? [run(text, { fontSize: size })],
  };
};

const page = (lines: StyledLine[], images: PageImage[] = []): PageContent => ({
  ...PAGE,
  lines,
  images,
});

const image = (x: number, y: number, w: number, h: number): PageImage => ({
  x,
  y,
  w,
  h,
  data: new Uint8Array([1]),
});

const paragraphs = (blocks: readonly Block[]): ParagraphBlock[] =>
  blocks.filter((b): b is ParagraphBlock => b.kind === 'paragraph');

const text = (p: ParagraphBlock): string =>
  p.runs.map((r) => ('tab' in r ? '\t' : r.text)).join('');

/** Texto de una línea llena, con palabras de tamaño normal. */
const FULL = Array.from({ length: 10 }, () => 'palabras').join(' ');

/** Línea llena: de 50 a 550, el ancho de la columna. */
const full = (top: number): StyledLine => line(FULL, 50, top, { width: 500 });

describe('buildLayout', () => {
  it('une en un párrafo las líneas que se parten solas al llegar al margen', () => {
    const layout = buildLayout([page([full(100), full(112), line('final corto', 50, 124)])]);
    const [p] = paragraphs(layout.pages[0]);
    expect(layout.pages[0]).toHaveLength(1);
    expect(text(p)).toBe(`${FULL} ${FULL} final corto`);
  });

  it('empieza un párrafo nuevo después de una línea corta', () => {
    const layout = buildLayout([page([full(100), line('Fin del primero.', 50, 112), full(124)])]);
    expect(paragraphs(layout.pages[0]).map(text)).toEqual([`${FULL} Fin del primero.`, FULL]);
  });

  it('vuelve a juntar las palabras partidas con guion', () => {
    const first = `${'x'.repeat(95)} pala-`;
    const layout = buildLayout([
      page([line(first, 50, 100, { width: 500 }), line('bra', 50, 112)]),
    ]);
    expect(text(paragraphs(layout.pages[0])[0])).toBe(`${'x'.repeat(95)} palabra`);
  });

  it('no junta una viñeta con la línea anterior', () => {
    const layout = buildLayout([page([full(100), line('• segundo punto', 50, 112), full(140)])]);
    expect(paragraphs(layout.pages[0]).map(text)[1]).toBe('• segundo punto');
  });

  it('marca como títulos los párrafos cortos con letra más grande', () => {
    const layout = buildLayout([
      page([
        line('Informe', 50, 40, { size: 24 }),
        line('Contexto', 50, 80, { size: 16 }),
        full(110),
        line('Fin.', 50, 122),
      ]),
    ]);
    expect(paragraphs(layout.pages[0]).map((p) => p.heading)).toEqual([1, 2, 0]);
  });

  it('convierte las celdas de un mismo renglón en una fila con tabuladores', () => {
    const layout = buildLayout([
      page([
        line('Nombre', 50, 100),
        line('Ana', 300, 100),
        line('Ciudad', 50, 130),
        line('Lugo', 300, 130),
      ]),
    ]);
    const rows = paragraphs(layout.pages[0]);
    expect(rows.map(text)).toEqual(['Nombre\tAna', 'Ciudad\tLugo']);
    expect(rows[0].tabStops).toEqual([300 - layout.margins.left]);
  });

  it('detecta el texto centrado', () => {
    const title = 'Acta de la reunión';
    const width = title.length * CHAR;
    const layout = buildLayout([page([line(title, 300 - width / 2, 60), full(100), full(112)])]);
    expect(paragraphs(layout.pages[0])[0].align).toBe('center');
  });

  it('calcula márgenes comunes y coloca las imágenes en su sitio', () => {
    const layout = buildLayout([page([line(FULL, 60, 100)], [image(60, 200, 200, 100)])]);
    expect(layout.margins.left).toBe(60);
    expect(layout.margins.top).toBe(100);
    const picture = layout.pages[0][1];
    expect(picture.kind).toBe('image');
    expect(picture.spaceBefore).toBeGreaterThan(80);
  });

  it('reduce las imágenes más anchas que el área de texto', () => {
    const layout = buildLayout([page([line('x', 50, 50)], [image(0, 100, 600, 300)])]);
    const picture = layout.pages[0].find((b) => b.kind === 'image');
    const textWidth = PAGE.width - layout.margins.left - layout.margins.right;
    expect(picture?.kind === 'image' && picture.width).toBeCloseTo(textWidth);
  });

  it('usa el tamaño de página más repetido', () => {
    const landscape = { ...page([]), width: 800, height: 600 };
    const layout = buildLayout([page([]), landscape, page([])]);
    expect([layout.pageWidth, layout.pageHeight]).toEqual([600, 800]);
  });

  it('mantiene las páginas vacías para no descuadrar los saltos de página', () => {
    expect(buildLayout([page([line('a', 50, 50)]), page([])]).pages).toHaveLength(2);
  });

  it('pone la imagen antes que el pie de foto que tiene al lado', () => {
    const layout = buildLayout([
      page([line('Figura 1. Pie de foto.', 200, 130)], [image(50, 100, 120, 60)]),
    ]);
    expect(layout.pages[0].map((b) => b.kind)).toEqual(['image', 'paragraph']);
  });

  it('sigue el párrafo en la columna de al lado si la última línea estaba llena', () => {
    // Dos columnas de 50–270 y 320–540 con renglones desalineados
    const words = Array.from({ length: 5 }, () => 'palabras').join(' ');
    const col = (x: number, top: number, text = words) => line(text, x, top, { width: 220 });
    const layout = buildLayout([
      page([
        col(50, 100),
        col(50, 112),
        col(50, 124),
        col(50, 136),
        col(320, 106),
        col(320, 118),
        col(320, 130),
        line('Fin.', 320, 142),
      ]),
    ]);
    const texts = paragraphs(layout.pages[0]).map(text);
    expect(texts).toHaveLength(1);
    expect(texts[0].endsWith('Fin.')).toBe(true);
  });
});

describe('cleanPage', () => {
  it('quita el fondo de las páginas con texto y conserva el texto', () => {
    const cleaned = cleanPage(page([line('Hola', 50, 50)], [image(0, 0, 600, 800)]));
    expect(cleaned.images).toHaveLength(0);
    expect(cleaned.lines).toHaveLength(1);
  });

  it('quita el texto que ya está dentro de una imagen', () => {
    const cleaned = cleanPage(
      page([line('etiqueta', 120, 150), line('fuera', 50, 400)], [image(100, 100, 200, 150)]),
    );
    expect(cleaned.lines.map((l) => l.runs[0].text)).toEqual(['fuera']);
  });

  it('quita los números de página de las cabeceras y los pies', () => {
    const cleaned = cleanPage(
      page([
        line('Página 3 de 10', 270, 770),
        line('- 4 -', 290, 20),
        line('12', 50, 400),
        line('Capítulo 2', 50, 770),
      ]),
    );
    expect(cleaned.lines.map((l) => l.runs[0].text)).toEqual(['12', 'Capítulo 2']);
  });

  it('reconoce una página escaneada', () => {
    expect(isScannedPage(page([], [image(0, 0, 600, 800)]))).toBe(true);
    expect(isScannedPage(page([line('a', 0, 0)], [image(0, 0, 600, 800)]))).toBe(false);
  });
});

describe('mergeRuns', () => {
  it('junta trozos seguidos con el mismo formato y respeta los cambios', () => {
    const merged = mergeRuns([
      run('Hola '),
      run('mundo'),
      run(' en negrita', { bold: true }),
      { tab: true },
      run('a'),
      run('b'),
    ]);
    expect(merged.map((r) => ('tab' in r ? '\t' : r.text))).toEqual([
      'Hola mundo',
      ' en negrita',
      '\t',
      'ab',
    ]);
  });
});
