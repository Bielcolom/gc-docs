import { loadImage } from '@core/utils';

/** Firma lista para colocar: PNG con fondo transparente y su tamaño en píxeles. */
export interface SignatureImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export type Stroke = readonly (readonly [number, number])[];

const TYPED_FONT_SIZE = 150;
const TYPED_PADDING = 30;
const DRAWN_OUTPUT_WIDTH = 1200;
const DRAWN_PADDING = 14;
const DRAWN_LINE_WIDTH = 7;
/** Luminosidad a partir de la cual un píxel se considera fondo blanco. */
const WHITE_THRESHOLD = 215;
const SOFT_EDGE = 55;
const MAX_UPLOAD_SIDE = 1600;

/** Dibuja un trazo suavizado con coordenadas normalizadas (0..1) en un lienzo de `w × h`. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  lineWidth: number,
  w: number,
  h: number,
): void {
  if (!stroke.length) return;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (stroke.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke[0][0] * w, stroke[0][1] * h, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(stroke[0][0] * w, stroke[0][1] * h);
  for (let i = 1; i < stroke.length - 1; i++) {
    const mx = ((stroke[i][0] + stroke[i + 1][0]) / 2) * w;
    const my = ((stroke[i][1] + stroke[i + 1][1]) / 2) * h;
    ctx.quadraticCurveTo(stroke[i][0] * w, stroke[i][1] * h, mx, my);
  }
  const last = stroke[stroke.length - 1];
  ctx.lineTo(last[0] * w, last[1] * h);
  ctx.stroke();
}

/** Recorta los trazos a su contenido y los dibuja a buena resolución. */
export function renderDrawnSignature(
  strokes: readonly Stroke[],
  color: string,
  aspectRatio: number,
): SignatureImage | null {
  const points = strokes.flat();
  if (!points.length) return null;
  const W = DRAWN_OUTPUT_WIDTH;
  const H = Math.round(W / aspectRatio);
  const xs = points.map((p) => p[0] * W);
  const ys = points.map((p) => p[1] * H);
  const minX = Math.max(0, Math.min(...xs) - DRAWN_PADDING);
  const minY = Math.max(0, Math.min(...ys) - DRAWN_PADDING);
  const maxX = Math.min(W, Math.max(...xs) + DRAWN_PADDING);
  const maxY = Math.min(H, Math.max(...ys) + DRAWN_PADDING);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(maxX - minX));
  canvas.height = Math.max(1, Math.round(maxY - minY));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.translate(-minX, -minY);
  ctx.strokeStyle = ctx.fillStyle = color;
  for (const stroke of strokes) drawStroke(ctx, stroke, DRAWN_LINE_WIDTH, W, H);
  return { src: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

/** Firma escrita con una tipografía manuscrita. */
export async function renderTypedSignature(
  text: string,
  cssFamily: string,
  color: string,
): Promise<SignatureImage | null> {
  const value = text.trim();
  if (!value) return null;
  const font = `${TYPED_FONT_SIZE}px ${cssFamily}`;
  await document.fonts.load(font);
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = font;
  const m = measure.measureText(value);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight + TYPED_PADDING * 2);
  canvas.height = Math.ceil(
    m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + TYPED_PADDING * 2,
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(
    value,
    TYPED_PADDING + m.actualBoundingBoxLeft,
    TYPED_PADDING + m.actualBoundingBoxAscent,
  );
  return { src: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

/** Vuelve transparente el papel blanco de una foto o escaneo de una firma. */
export async function removeWhiteBackground(image: SignatureImage): Promise<SignatureImage> {
  const img = await loadImage(image.src);
  const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const luminance = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (luminance > WHITE_THRESHOLD) d[i + 3] = 0;
    else if (luminance > WHITE_THRESHOLD - SOFT_EDGE)
      d[i + 3] = Math.round(d[i + 3] * ((WHITE_THRESHOLD - luminance) / SOFT_EDGE));
  }
  ctx.putImageData(pixels, 0, 0);
  return { src: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}
