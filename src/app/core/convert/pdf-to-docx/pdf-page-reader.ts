import { guessFontStyle } from '@core/fonts';
import type { Matrix, RawTextItem, Rect, TextLine } from '@core/models';
import { type PDFPageProxy, type PdfJs, readTextItems, sampleTextColors } from '@core/pdf';
import { IDENTITY, applyMatrix, canvasToBlob, groupTextItems, multiply } from '@core/utils';
import { type ColorPalette, docsFontFamily, docsTextColor } from './docs-style';
import type { PageContent, PageImage, StyledLine, StyledRun } from './layout.model';

/** Resolución del render del que se recortan las imágenes y se muestrea el color del texto. */
const RENDER_SCALE = 2;
const MAX_RENDER_PIXELS = 12_000_000;
/** Las imágenes más pequeñas (en puntos) suelen ser adornos o restos de maquetación. */
const MIN_IMAGE_SIDE = 8;
const MIN_IMAGE_AREA = 400;

type Ops = PdfJs['OPS'];

/**
 * Lee una página: líneas de texto con su formato e imágenes ya recortadas.
 * @param palette Colores ya vistos en el documento, para unificar los casi iguales.
 */
export async function readPdfPage(
  pdfjs: PdfJs,
  page: PDFPageProxy,
  document: Document,
  palette: ColorPalette,
): Promise<PageContent> {
  const viewport = page.getViewport({ scale: 1 });
  const vt = [...viewport.transform] as unknown as Matrix;
  const { width, height } = viewport;

  // Pedir las operaciones carga también las fuentes, y con ellas su nombre real (negrita, cursiva…)
  const imageBoxes = findImageBoxes(pdfjs.OPS, await page.getOperatorList(), vt, width, height);
  const scale = Math.min(RENDER_SCALE, Math.sqrt(MAX_RENDER_PIXELS / (width * height)));
  const canvas = await renderPage(page, scale, document);
  try {
    const items = await readTextItems(page, vt);
    const lines = groupTextItems(items).map((line) =>
      styleLine(line, items, canvas, width, palette),
    );
    const images = await Promise.all(
      imageBoxes.map((box) => cropImage(canvas, box, scale, document)),
    );
    return { width, height, lines, images };
  } finally {
    canvas.width = 0;
  }
}

/** Divide la línea en trozos con un solo formato, uno por fragmento de pdf.js. */
function styleLine(
  line: TextLine,
  items: readonly RawTextItem[],
  canvas: HTMLCanvasElement,
  pageWidth: number,
  palette: ColorPalette,
): StyledLine {
  const runs: StyledRun[] = [];
  let end = 0;
  for (const segment of line.segments) {
    // El espacio que `groupTextItems` añade entre fragmentos va con el trozo siguiente
    const text = line.text.slice(end, segment.end);
    end = segment.end;
    if (!text) continue;
    const item = items[segment.item];
    const style = guessFontStyle(item.fontRealName || item.fontName, item.fontFamily);
    const area: Rect = { x: segment.x, y: line.y, w: segment.width, h: line.height };
    runs.push({
      text,
      fontSize: Math.round(item.fontSize * 2) / 2,
      font: docsFontFamily(item.fontRealName, style.font),
      bold: style.bold,
      italic: style.italic,
      color: palette.normalize(docsTextColor(sampleTextColors(canvas, area, pageWidth).text)),
    });
  }
  return {
    x: line.x,
    y: line.y,
    w: line.width,
    h: line.height,
    baseline: line.baseline,
    fontSize: line.fontSize,
    runs,
  };
}

/**
 * Dónde se pinta cada imagen, en el espacio base. Se sigue la matriz de transformación a lo largo
 * de las operaciones (guardar, restaurar, transformar, formularios) y se lleva el cuadrado unidad
 * de cada imagen a la página.
 */
export function findImageBoxes(
  ops: Ops,
  operatorList: { readonly fnArray: readonly number[]; readonly argsArray: readonly unknown[] },
  viewportTransform: Matrix,
  pageWidth: number,
  pageHeight: number,
): Rect[] {
  const paintOps = new Set<number>([
    ops.paintImageXObject,
    ops.paintInlineImageXObject,
    ops.paintImageMaskXObject,
  ]);
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  const boxes: Rect[] = [];

  operatorList.fnArray.forEach((fn, i) => {
    const args = operatorList.argsArray[i] as unknown[] | null;
    if (fn === ops.save) stack.push(ctm);
    else if (fn === ops.restore) ctm = stack.pop() ?? ctm;
    else if (fn === ops.transform && args) ctm = multiply(ctm, toMatrix(args) ?? IDENTITY);
    else if (fn === ops.paintFormXObjectBegin) {
      stack.push(ctm);
      const matrix = args && toMatrix(args[0]);
      if (matrix) ctm = multiply(ctm, matrix);
    } else if (fn === ops.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (paintOps.has(fn)) {
      const box = clipToPage(unitSquare(multiply(viewportTransform, ctm)), pageWidth, pageHeight);
      if (
        box &&
        box.w >= MIN_IMAGE_SIDE &&
        box.h >= MIN_IMAGE_SIDE &&
        box.w * box.h >= MIN_IMAGE_AREA
      )
        boxes.push(box);
    }
  });
  return dedupe(boxes);
}

function toMatrix(value: unknown): Matrix | null {
  if (!value || typeof value !== 'object' || !('length' in value)) return null;
  const m = Array.from(value as ArrayLike<number>);
  return m.length === 6 && m.every(Number.isFinite) ? (m as unknown as Matrix) : null;
}

function unitSquare(m: Matrix): Rect {
  const corners = [
    applyMatrix(m, { x: 0, y: 0 }),
    applyMatrix(m, { x: 1, y: 0 }),
    applyMatrix(m, { x: 0, y: 1 }),
    applyMatrix(m, { x: 1, y: 1 }),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function clipToPage(box: Rect, width: number, height: number): Rect | null {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const w = Math.min(width, box.x + box.w) - x;
  const h = Math.min(height, box.y + box.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/** La misma imagen pintada dos veces en el mismo sitio (máscaras, sombras) se recorta una vez. */
function dedupe(boxes: readonly Rect[]): Rect[] {
  const seen = new Set<string>();
  return boxes.filter((b) => {
    const key = [b.x, b.y, b.w, b.h].map(Math.round).join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function renderPage(
  page: PDFPageProxy,
  scale: number,
  document: Document,
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // Con la intención de imprimir, pdf.js pinta de un tirón en vez de a cada `requestAnimationFrame`,
  // que el navegador pausa si la pestaña queda en segundo plano durante una conversión larga
  await page.render({ canvas, viewport, intent: 'print', background: '#ffffff' }).promise;
  return canvas;
}

/**
 * Recorta la imagen del render de la página en vez de extraer el archivo original: así sale tal y
 * como se ve (con máscaras, recortes y espacio de color ya aplicados), sea cual sea su formato.
 */
async function cropImage(
  source: HTMLCanvasElement,
  box: Rect,
  scale: number,
  document: Document,
): Promise<PageImage> {
  const sx = Math.floor(box.x * scale);
  const sy = Math.floor(box.y * scale);
  const sw = Math.max(1, Math.min(source.width - sx, Math.ceil(box.w * scale)));
  const sh = Math.max(1, Math.min(source.height - sy, Math.ceil(box.h * scale)));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d')?.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await canvasToBlob(canvas, 'image/png');
  canvas.width = 0;
  return { ...box, data: new Uint8Array(await blob.arrayBuffer()) };
}
