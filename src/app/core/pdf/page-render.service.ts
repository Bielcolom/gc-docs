import { DOCUMENT, Injectable, inject } from '@angular/core';
import type { PageRef } from '@core/models';
import { canvasToBlob } from '@core/utils';
import { PdfEngineService } from './pdf-engine.service';
import { SourceRegistryService } from './source-registry.service';

export interface RenderOptions {
  /** Píxeles por punto PDF. */
  readonly scale: number;
  /** No dibujar los campos de formulario (se muestran como controles HTML). */
  readonly hideFormFields?: boolean;
  /** Permite cancelar el render si ya no hace falta. */
  readonly signal?: AbortSignal;
}

/** Dibuja páginas de PDF en lienzos, sin parpadeos y cancelando los renders obsoletos. */
@Injectable({ providedIn: 'root' })
export class PageRenderService {
  private readonly document = inject(DOCUMENT);
  private readonly sources = inject(SourceRegistryService);
  private readonly engine = inject(PdfEngineService);

  /**
   * Pinta la página en un lienzo aparte y lo copia al destino solo al terminar,
   * para que no se vea la página en blanco mientras se redibuja.
   */
  async renderInto(
    target: HTMLCanvasElement,
    page: PageRef,
    options: RenderOptions,
  ): Promise<void> {
    const offscreen = await this.render(page, options);
    if (options.signal?.aborted) return;
    target.width = offscreen.width;
    target.height = offscreen.height;
    target.getContext('2d')?.drawImage(offscreen, 0, 0);
    offscreen.width = 0;
  }

  async render(page: PageRef, options: RenderOptions): Promise<HTMLCanvasElement> {
    const pdfPage = await this.sources.getPageFor(page);
    const viewport = pdfPage.getViewport({ scale: options.scale });
    const canvas = this.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const task = pdfPage.render({
      canvas,
      viewport,
      background: '#ffffff',
      annotationMode: options.hideFormFields ? await this.engine.formsAnnotationMode() : undefined,
    });
    options.signal?.addEventListener('abort', () => task.cancel(), { once: true });
    await task.promise;
    return canvas;
  }

  /** Imagen JPEG de la página (para exportar archivos que pdf-lib no puede reescribir). */
  async renderJpeg(page: PageRef, scale: number): Promise<Uint8Array> {
    const canvas = await this.render(page, { scale });
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    return new Uint8Array(await blob.arrayBuffer());
  }
}
