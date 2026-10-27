import { Injectable, inject } from '@angular/core';
import type { Matrix } from '@core/models';
import { APP_BASE_URL } from '@core/tokens/app-base-url.token';
import type * as PdfJsModule from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { PasswordRequiredError } from './pdf-errors';

export type { PDFDocumentProxy, PDFPageProxy };

export type PdfJs = typeof PdfJsModule;

export interface PageGeometry {
  readonly width: number;
  readonly height: number;
  readonly viewportTransform: Matrix;
}

/**
 * Punto de acceso a pdf.js: configuración del worker y apertura de documentos.
 *
 * La librería (~450 kB) se descarga la primera vez que se necesita, para que la
 * pantalla de inicio cargue rápido.
 */
@Injectable({ providedIn: 'root' })
export class PdfEngineService {
  private readonly baseUrl = inject(APP_BASE_URL);
  private libraryPromise: Promise<PdfJs> | null = null;

  /** Módulo de pdf.js ya configurado. */
  library(): Promise<PdfJs> {
    this.libraryPromise ??= import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${this.baseUrl}pdfjs/pdf.worker.min.mjs`;
      return pdfjs;
    });
    return this.libraryPromise;
  }

  async open(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
    const pdfjs = await this.library();
    const task = pdfjs.getDocument({
      // pdf.js transfiere el buffer al worker: se le pasa una copia para conservar el original
      data: bytes.slice(),
      password,
      cMapUrl: `${this.baseUrl}pdfjs/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${this.baseUrl}pdfjs/standard_fonts/`,
      wasmUrl: `${this.baseUrl}pdfjs/wasm/`,
      iccUrl: `${this.baseUrl}pdfjs/iccs/`,
      fontExtraProperties: true,
    });
    try {
      return await task.promise;
    } catch (error) {
      if (error instanceof Error && error.name === 'PasswordException') {
        const code = (error as Error & { code?: number }).code;
        throw new PasswordRequiredError(code === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
      }
      throw error;
    }
  }

  geometry(page: PDFPageProxy): PageGeometry {
    const viewport = page.getViewport({ scale: 1 });
    const t = viewport.transform;
    return {
      width: viewport.width,
      height: viewport.height,
      viewportTransform: [t[0], t[1], t[2], t[3], t[4], t[5]],
    };
  }

  /** Modo de pdf.js que deja los campos de formulario sin pintar (se muestran como controles HTML). */
  async formsAnnotationMode(): Promise<number> {
    return (await this.library()).AnnotationMode.ENABLE_FORMS;
  }
}
