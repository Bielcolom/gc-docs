import { DOCUMENT, Injectable, inject } from '@angular/core';
import type { ConversionOptions, ConversionResult, Converter } from '@core/models';
import { PdfEngineService, openWithPassword } from '@core/pdf';
import { USER_PROMPTS } from '@core/tokens/user-prompts.token';
import { baseName, readFileBytes } from '@core/utils';
import { ConversionCancelledError } from '../conversion-errors';
import { convertedFileName } from '../file-formats';
import { ColorPalette } from './docs-style';
import { writeDocx } from './docx-writer';
import { buildLayout, isScannedPage } from './layout';
import type { PageContent } from './layout.model';
import { readPdfPage } from './pdf-page-reader';

/**
 * PDF → .docx pensado para Google Docs. Reconstruye el documento como texto que fluye
 * (párrafos, títulos, columnas leídas en orden, filas con tabuladores e imágenes), no como
 * una copia exacta de cada página: así se puede seguir editando cómodamente.
 */
@Injectable({ providedIn: 'root' })
export class PdfToDocxConverter implements Converter {
  private readonly engine = inject(PdfEngineService);
  private readonly prompts = inject(USER_PROMPTS);
  private readonly document = inject(DOCUMENT);

  async convert(file: File, options: ConversionOptions = {}): Promise<ConversionResult> {
    const bytes = await readFileBytes(file);
    const pdf = await openWithPassword(this.prompts, file.name, (password) =>
      this.engine.open(bytes, password),
    );
    if (!pdf) throw new ConversionCancelledError();

    try {
      const pdfjs = await this.engine.library();
      const pages: PageContent[] = [];
      const palette = new ColorPalette();
      for (let n = 1; n <= pdf.numPages; n++) {
        options.signal?.throwIfAborted();
        const page = await pdf.getPage(n);
        pages.push(await readPdfPage(pdfjs, page, this.document, palette));
        page.cleanup();
        options.onProgress?.({ done: n, total: pdf.numPages });
      }
      options.signal?.throwIfAborted();

      const layout = buildLayout(pages);
      const blob = await writeDocx(layout, { title: baseName(file.name) });
      return {
        blob,
        fileName: convertedFileName(file.name, 'docx'),
        warnings: warningsFor(pages, layout.pageWidth, layout.pageHeight),
      };
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
}

function warningsFor(pages: readonly PageContent[], width: number, height: number): string[] {
  const warnings: string[] = [];
  const scanned = pages.flatMap((page, i) => (isScannedPage(page) ? [i + 1] : []));
  if (scanned.length === pages.length) {
    warnings.push(
      'El PDF no tiene texto seleccionable (parece escaneado): las páginas van como imágenes.',
    );
  } else if (scanned.length) {
    warnings.push(
      `${pageList(scanned)} no ${scanned.length === 1 ? 'tiene' : 'tienen'} texto seleccionable ` +
        'y van como imagen.',
    );
  }
  const resized = pages.filter(
    (p) => Math.abs(p.width - width) > 2 || Math.abs(p.height - height) > 2,
  );
  if (resized.length) {
    warnings.push(
      'Las páginas tienen tamaños distintos y Google Docs solo admite uno: se usa el más común.',
    );
  }
  return warnings;
}

function pageList(numbers: readonly number[]): string {
  if (numbers.length === 1) return `La página ${numbers[0]}`;
  const shown = numbers.slice(0, 5);
  const rest = numbers.length > shown.length ? ` y ${numbers.length - shown.length} más` : '';
  return `Las páginas ${shown.join(', ')}${rest}`;
}
