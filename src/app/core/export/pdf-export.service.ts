import { Injectable, inject } from '@angular/core';
import { FontMetricsService } from '@core/fonts';
import type {
  Annotation,
  DocumentState,
  FormValue,
  Matrix,
  NoteAnnotation,
  PageRef,
} from '@core/models';
import { PageRenderService, SourceRegistryService } from '@core/pdf';
import { LoggerService } from '@core/services/logger.service';
import { DocumentStore } from '@core/state';
import { ENVIRONMENT } from '@core/tokens/environment.token';
import { dataUrlToBytes, pageNumberLabel } from '@core/utils';
import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  concatTransformationMatrix,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { AnnotationPainter } from './annotation-painter';
import { baseToPdf, displayToPdf } from './coordinate-spaces';
import { paintPageNumber, paintWatermark } from './decorations-painter';
import { FontFileLoaderService } from './font-file-loader.service';
import { fillForm } from './form-filler';
import { addNoteAnnotation } from './note-annotation';
import { PdfFontRegistry } from './pdf-font-registry';

/** Resolución con la que se rasterizan las páginas de PDFs cifrados. */
const RASTER_SCALE = 2;

export interface ExportOptions {
  /** Exportar solo estas páginas, en este orden. Por defecto, todas. */
  readonly pageIds?: readonly string[];
}

export interface ExportResult {
  readonly bytes: Uint8Array;
  /** Alguna página se ha tenido que guardar como imagen (PDF cifrado). */
  readonly rasterized: boolean;
}

interface OutputPage {
  readonly page: PDFPage;
  readonly ref: PageRef;
}

/**
 * Genera el PDF final aplicando todas las ediciones.
 *
 * Si el documento es un único PDF sin reordenar, se edita ese mismo archivo para conservar
 * formularios interactivos, enlaces y marcadores. En otro caso se copian las páginas a un PDF nuevo.
 */
@Injectable({ providedIn: 'root' })
export class PdfExportService {
  private readonly store = inject(DocumentStore);
  private readonly sources = inject(SourceRegistryService);
  private readonly renderer = inject(PageRenderService);
  private readonly fontFiles = inject(FontFileLoaderService);
  private readonly metrics = inject(FontMetricsService);
  private readonly logger = inject(LoggerService);
  private readonly appName = inject(ENVIRONMENT).appName;

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    const state = this.store.state();
    const pages = this.selectPages(state, options.pageIds);
    if (!pages.length) throw new Error('No hay páginas que exportar');

    const inPlace = this.canEditInPlace(pages);
    const loaded = new Map<string, PDFDocument | null>();
    const load = (sourceId: string) => this.loadSource(sourceId, state, !inPlace, loaded);

    let output: PDFDocument;
    let outputPages: OutputPage[];
    let rasterized = false;

    if (inPlace) {
      const doc = await load(pages[0].sourceId);
      if (!doc) throw new Error('No se pudo leer el PDF');
      output = doc;
      outputPages = doc.getPages().map((page, i) => ({ page, ref: pages[i] }));
    } else {
      output = await PDFDocument.create();
      const result = await this.copyPages(output, pages, load);
      outputPages = result.pages;
      rasterized = result.rasterized;
    }

    output.registerFontkit(fontkit);
    const fonts = new PdfFontRegistry(output, (file) => this.fontFiles.load(file));
    const embedImage = this.imageEmbedder(output);
    const byPage = this.store.annotationsByPage();

    for (let i = 0; i < outputPages.length; i++) {
      const { page, ref } = outputPages[i];
      const intrinsic = page.getRotation().angle;
      page.setRotation(degrees((((intrinsic + ref.rotation) % 360) + 360) % 360));
      await this.paintAnnotations(output, page, ref, byPage.get(ref.id) ?? [], fonts, embedImage);
      await this.paintDecorations(page, ref, state, i, outputPages.length, fonts);
    }

    this.writeMetadata(output, state);
    return { bytes: await output.save({ useObjectStreams: true }), rasterized };
  }

  private selectPages(state: DocumentState, ids?: readonly string[]): PageRef[] {
    if (!ids) return [...state.pages];
    return ids.flatMap((id) => state.pages.find((p) => p.id === id) ?? []);
  }

  private canEditInPlace(pages: readonly PageRef[]): boolean {
    const info = this.sources.info(pages[0].sourceId);
    return (
      !!info &&
      !info.encrypted &&
      pages.length === info.pageCount &&
      pages.every((p, i) => p.sourceId === info.id && p.sourceIndex === i)
    );
  }

  private async loadSource(
    sourceId: string,
    state: DocumentState,
    flattenForms: boolean,
    cache: Map<string, PDFDocument | null>,
  ): Promise<PDFDocument | null> {
    if (cache.has(sourceId)) return cache.get(sourceId) ?? null;
    let doc: PDFDocument | null = null;
    if (!this.sources.info(sourceId)?.encrypted) {
      try {
        doc = await PDFDocument.load(this.sources.bytes(sourceId), { updateMetadata: false });
        const failed = fillForm(doc, this.formValuesFor(sourceId, state), flattenForms);
        if (failed.length) this.logger.warn('No se pudieron rellenar algunos campos', failed);
      } catch (error) {
        this.logger.warn('pdf-lib no pudo leer el archivo; se exportará como imagen', error);
        doc = null;
      }
    }
    cache.set(sourceId, doc);
    return doc;
  }

  private formValuesFor(sourceId: string, state: DocumentState): Map<string, FormValue> {
    const prefix = `${sourceId}::`;
    return new Map(
      Object.entries(state.formValues)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.slice(prefix.length), value]),
    );
  }

  /** Copia las páginas al PDF de salida agrupando por archivo (para compartir recursos). */
  private async copyPages(
    output: PDFDocument,
    pages: readonly PageRef[],
    load: (sourceId: string) => Promise<PDFDocument | null>,
  ): Promise<{ pages: OutputPage[]; rasterized: boolean }> {
    const indexesBySource = new Map<string, number[]>();
    pages.forEach((p, i) =>
      indexesBySource.set(p.sourceId, [...(indexesBySource.get(p.sourceId) ?? []), i]),
    );

    const copied = new Map<number, PDFPage>();
    const rasterizedIndexes = new Set<number>();
    let rasterized = false;
    for (const [sourceId, indexes] of indexesBySource) {
      const doc = await load(sourceId);
      if (doc) {
        const result = await output.copyPages(
          doc,
          indexes.map((i) => pages[i].sourceIndex),
        );
        result.forEach((page, k) => copied.set(indexes[k], page));
        continue;
      }
      rasterized = true;
      for (const i of indexes) {
        copied.set(i, await this.rasterizedPage(output, pages[i]));
        rasterizedIndexes.add(i);
      }
    }

    const result = pages.map((ref, i) => {
      const page = output.addPage(copied.get(i)!);
      const isRaster = !this.sources.info(ref.sourceId) || rasterizedIndexes.has(i);
      return { page, ref: isRaster ? this.flatRef(ref) : ref };
    });
    return { pages: result, rasterized };
  }

  /** Página de un PDF cifrado convertida en imagen (la imagen ya incluye su rotación propia). */
  private async rasterizedPage(output: PDFDocument, ref: PageRef): Promise<PDFPage> {
    const scratch = await PDFDocument.create();
    const image = await scratch.embedJpg(await this.renderer.renderJpeg(ref, RASTER_SCALE));
    scratch
      .addPage([ref.width, ref.height])
      .drawImage(image, { x: 0, y: 0, width: ref.width, height: ref.height });
    const [page] = await output.copyPages(scratch, [0]);
    return page;
  }

  /** Una página rasterizada ya no tiene rotación propia: su transformación es un simple volteo. */
  private flatRef(ref: PageRef): PageRef {
    return { ...ref, viewportTransform: [1, 0, 0, -1, 0, ref.height] };
  }

  private imageEmbedder(doc: PDFDocument): (src: string) => Promise<PDFImage> {
    const cache = new Map<string, Promise<PDFImage>>();
    return (src) => {
      let image = cache.get(src);
      if (!image) {
        const bytes = dataUrlToBytes(src);
        image = src.startsWith('data:image/png') ? doc.embedPng(bytes) : doc.embedJpg(bytes);
        cache.set(src, image);
      }
      return image;
    };
  }

  private async paintAnnotations(
    doc: PDFDocument,
    page: PDFPage,
    ref: PageRef,
    annotations: readonly Annotation[],
    fonts: PdfFontRegistry,
    embedImage: (src: string) => Promise<PDFImage>,
  ): Promise<void> {
    if (!annotations.length) return;
    const matrix = baseToPdf(ref);
    const painter = new AnnotationPainter({
      page,
      height: ref.height,
      fonts,
      embedImage,
      baselineOffset: (font, bold, italic, size) =>
        this.metrics.baselineOffset(font, bold, italic, size),
    });
    await this.withMatrix(page, matrix, async () => {
      for (const a of annotations) await painter.paint(a);
    });
    for (const note of annotations.filter((a): a is NoteAnnotation => a.type === 'note')) {
      addNoteAnnotation(doc, page, note, matrix, ref.height, this.appName);
    }
  }

  private async paintDecorations(
    page: PDFPage,
    ref: PageRef,
    state: DocumentState,
    index: number,
    total: number,
    fonts: PdfFontRegistry,
  ): Promise<void> {
    const label = pageNumberLabel(state.pageNumbers, index, total);
    if (!state.watermark.enabled && label === null) return;
    const { matrix, size } = displayToPdf(ref);
    await this.withMatrix(page, matrix, async () => {
      await paintWatermark(page, size, state.watermark, fonts);
      if (label !== null) await paintPageNumber(page, size, state.pageNumbers, label, fonts);
    });
  }

  /**
   * Dibuja dentro de `q … cm … Q` para usar otro sistema de coordenadas
   * sin afectar al contenido original de la página.
   */
  private async withMatrix(
    page: PDFPage,
    matrix: Matrix,
    draw: () => Promise<void>,
  ): Promise<void> {
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...matrix));
    try {
      await draw();
    } finally {
      page.pushOperators(popGraphicsState());
    }
  }

  private writeMetadata(doc: PDFDocument, state: DocumentState): void {
    const { title, author, subject, keywords } = state.metadata;
    if (title) doc.setTitle(title, { showInWindowTitleBar: true });
    if (author) doc.setAuthor(author);
    if (subject) doc.setSubject(subject);
    if (keywords)
      doc.setKeywords(
        keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      );
    doc.setProducer(`${this.appName} · editor de PDF`);
    doc.setModificationDate(new Date());
  }
}
