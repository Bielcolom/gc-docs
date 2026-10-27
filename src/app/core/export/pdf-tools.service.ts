import { DOCUMENT, Injectable, inject } from '@angular/core';
import { PdfEngineService } from '@core/pdf';
import { DownloadService } from '@core/services/download.service';
import { DocumentStore } from '@core/state';
import { canvasToBlob } from '@core/utils';
import JSZip from 'jszip';
import { PdfExportService } from './pdf-export.service';

/** Operaciones de salida que generan varios archivos: dividir, imágenes e impresión. */
@Injectable({ providedIn: 'root' })
export class PdfToolsService {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(DocumentStore);
  private readonly exporter = inject(PdfExportService);
  private readonly engine = inject(PdfEngineService);
  private readonly downloads = inject(DownloadService);

  /** Descarga un PDF. Devuelve `true` si alguna página se guardó como imagen. */
  async downloadPdf(pageIds?: readonly string[], suffix = ''): Promise<boolean> {
    const { bytes, rasterized } = await this.exporter.export({ pageIds });
    this.downloads.save(bytes, `${this.store.fileName()}${suffix}.pdf`);
    return rasterized;
  }

  /** Un PDF por grupo de páginas (índices base 0), todos dentro de un ZIP. */
  async downloadSplit(groups: readonly (readonly number[])[]): Promise<void> {
    const pages = this.store.pages();
    const name = this.store.fileName();
    const zip = new JSZip();
    for (const [n, group] of groups.entries()) {
      const { bytes } = await this.exporter.export({ pageIds: group.map((i) => pages[i].id) });
      const first = group[0] + 1;
      const last = group[group.length - 1] + 1;
      const range = first === last ? `p${first}` : `p${first}-${last}`;
      zip.file(`${name}_${String(n + 1).padStart(2, '0')}_${range}.pdf`, bytes);
    }
    this.downloads.save(
      await zip.generateAsync({ type: 'blob' }),
      `${name}_dividido.zip`,
      'application/zip',
    );
  }

  /** Exporta cada página como PNG (con las ediciones aplicadas). */
  async downloadImages(dpi: number): Promise<void> {
    const { bytes } = await this.exporter.export();
    const pdf = await this.engine.open(bytes);
    const name = this.store.fileName();
    const images: Blob[] = [];
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: dpi / 72 });
        const canvas = this.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport, background: '#ffffff' }).promise;
        images.push(await canvasToBlob(canvas, 'image/png'));
      }
    } finally {
      await pdf.loadingTask.destroy();
    }
    if (images.length === 1) {
      this.downloads.save(images[0], `${name}.png`, 'image/png');
      return;
    }
    const zip = new JSZip();
    images.forEach((blob, i) => zip.file(`${name}_${String(i + 1).padStart(3, '0')}.png`, blob));
    this.downloads.save(
      await zip.generateAsync({ type: 'blob' }),
      `${name}_imagenes.zip`,
      'application/zip',
    );
  }

  async print(): Promise<void> {
    const { bytes } = await this.exporter.export();
    this.downloads.print(bytes);
  }
}
