import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

let configured = false;

export function baseHref(): string {
  const href = document.querySelector('base')?.getAttribute('href') ?? '/';
  return href.endsWith('/') ? href : href + '/';
}

function configure(): void {
  if (configured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = `${baseHref()}pdfjs/pdf.worker.min.mjs`;
  configured = true;
}

export class PasswordRequiredError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? 'Contraseña incorrecta' : 'Este PDF necesita contraseña');
  }
}

export async function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  configure();
  const root = new URL(baseHref(), location.href).href;
  // pdf.js se queda con el buffer: le pasamos una copia
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    password,
    cMapUrl: `${root}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${root}pdfjs/standard_fonts/`,
    wasmUrl: `${root}pdfjs/wasm/`,
    iccUrl: `${root}pdfjs/iccs/`,
    fontExtraProperties: true,
  });
  try {
    return await task.promise;
  } catch (e: any) {
    if (e?.name === 'PasswordException') {
      throw new PasswordRequiredError(e.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
    }
    throw e;
  }
}

export interface PageGeometry {
  w: number;
  h: number;
  vt: number[];
}

export function pageGeometry(page: PDFPageProxy): PageGeometry {
  const vp = page.getViewport({ scale: 1 });
  return { w: vp.width, h: vp.height, vt: [...vp.transform] };
}

export const AnnotationMode = pdfjs.AnnotationMode;
export const Util = pdfjs.Util;
export type { PDFDocumentProxy, PDFPageProxy };
