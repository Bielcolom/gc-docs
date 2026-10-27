import { A4 } from '@core/constants';
import { dataUrlToBytes, type LoadedImage } from '@core/utils';

/** Puntos por píxel al convertir imágenes (96 ppp de pantalla → 72 ppp de PDF). */
const POINTS_PER_PIXEL = 72 / 96;
/** Lado máximo de una página creada a partir de una imagen. */
const MAX_IMAGE_PAGE_SIDE = 1190;

/** pdf-lib se descarga solo cuando hace falta crear o comprobar un PDF. */
const loadPdfLib = () => import('pdf-lib');

export async function createBlankPdf(
  width: number = A4.width,
  height: number = A4.height,
): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);
  return doc.save();
}

/** Crea un PDF con una página por imagen, del tamaño de la imagen. */
export async function createPdfFromImages(images: readonly LoadedImage[]): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  for (const image of images) {
    const bytes = dataUrlToBytes(image.src);
    const embedded = image.src.startsWith('data:image/png')
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    let width = image.width * POINTS_PER_PIXEL;
    let height = image.height * POINTS_PER_PIXEL;
    const k = Math.min(1, MAX_IMAGE_PAGE_SIDE / Math.max(width, height));
    width *= k;
    height *= k;
    doc.addPage([width, height]).drawImage(embedded, { x: 0, y: 0, width, height });
  }
  return doc.save();
}

/** `true` si pdf-lib puede reescribir el archivo (no está cifrado ni dañado). */
export async function isEditableByPdfLib(bytes: Uint8Array): Promise<boolean> {
  const { PDFDocument } = await loadPdfLib();
  try {
    await PDFDocument.load(bytes, { updateMetadata: false });
    return true;
  } catch {
    return false;
  }
}
