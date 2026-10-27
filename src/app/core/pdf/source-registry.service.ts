import { Injectable, inject, signal } from '@angular/core';
import type { PageRef, SourceInfo } from '@core/models';
import { createId } from '@core/utils';
import { isEditableByPdfLib } from './pdf-factory';
import { PdfEngineService, type PDFDocumentProxy, type PDFPageProxy } from './pdf-engine.service';

interface LoadedSource {
  readonly info: SourceInfo;
  readonly bytes: Uint8Array;
  readonly pdf: PDFDocumentProxy;
  readonly pages: Map<number, Promise<PDFPageProxy>>;
}

/**
 * Archivos PDF cargados en memoria. No forma parte del historial de deshacer:
 * los archivos solo se añaden, y el documento hace referencia a ellos por id.
 */
@Injectable({ providedIn: 'root' })
export class SourceRegistryService {
  private readonly engine = inject(PdfEngineService);
  private readonly sources = new Map<string, LoadedSource>();
  /** Se incrementa con cada archivo nuevo, para que los `computed` que dependen de la lista se recalculen. */
  private readonly version = signal(0);

  readonly changes = this.version.asReadonly();

  /** Abre un PDF, lo registra y devuelve sus páginas listas para añadir al documento. */
  async register(bytes: Uint8Array, name: string, password?: string): Promise<PageRef[]> {
    const pdf = await this.engine.open(bytes, password);
    const encrypted = !!password || !(await isEditableByPdfLib(bytes));
    const info: SourceInfo = { id: createId('src'), name, pageCount: pdf.numPages, encrypted };
    this.sources.set(info.id, { info, bytes, pdf, pages: new Map() });
    this.version.update((v) => v + 1);

    const pages: PageRef[] = [];
    for (let i = 0; i < pdf.numPages; i++) {
      const geometry = this.engine.geometry(await this.getPage(info.id, i));
      pages.push({
        id: createId('pg'),
        sourceId: info.id,
        sourceIndex: i,
        rotation: 0,
        ...geometry,
      });
    }
    return pages;
  }

  getPage(sourceId: string, index: number): Promise<PDFPageProxy> {
    const source = this.require(sourceId);
    let page = source.pages.get(index);
    if (!page) {
      page = source.pdf.getPage(index + 1);
      source.pages.set(index, page);
    }
    return page;
  }

  getPageFor(ref: Pick<PageRef, 'sourceId' | 'sourceIndex'>): Promise<PDFPageProxy> {
    return this.getPage(ref.sourceId, ref.sourceIndex);
  }

  info(sourceId: string): SourceInfo | undefined {
    return this.sources.get(sourceId)?.info;
  }

  bytes(sourceId: string): Uint8Array {
    return this.require(sourceId).bytes;
  }

  /** Nombre visible del archivo, sin la extensión `.pdf`. */
  displayName(sourceId: string): string {
    return (this.sources.get(sourceId)?.info.name ?? 'documento').replace(/\.pdf$/i, '');
  }

  /** Ids en el orden en que se abrieron los archivos. */
  ids(): string[] {
    this.version();
    return [...this.sources.keys()];
  }

  clear(): void {
    for (const source of this.sources.values()) void source.pdf.loadingTask.destroy();
    this.sources.clear();
    this.version.update((v) => v + 1);
  }

  private require(sourceId: string): LoadedSource {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Archivo no encontrado: ${sourceId}`);
    return source;
  }
}
