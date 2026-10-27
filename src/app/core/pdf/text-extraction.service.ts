import { Injectable, inject } from '@angular/core';
import type { Matrix, PageRef, RawTextItem, TextLine } from '@core/models';
import { groupTextItems, multiply } from '@core/utils';
import type { PDFPageProxy } from './pdf-engine.service';
import { SourceRegistryService } from './source-registry.service';

interface PdfJsTextItem {
  readonly str: string;
  readonly transform: number[];
  readonly width: number;
  readonly fontName: string;
}

interface PdfJsTextStyle {
  readonly ascent?: number;
  readonly descent?: number;
  readonly fontFamily?: string;
}

const DEFAULT_ASCENT = 0.8;
const DEFAULT_DESCENT = 0.2;

/** Extrae las líneas de texto de las páginas (para editarlas y para buscar). */
@Injectable({ providedIn: 'root' })
export class TextExtractionService {
  private readonly sources = inject(SourceRegistryService);
  private readonly cache = new WeakMap<PDFPageProxy, Promise<TextLine[]>>();

  async getLines(page: PageRef): Promise<TextLine[]> {
    const pdfPage = await this.sources.getPageFor(page);
    let lines = this.cache.get(pdfPage);
    if (!lines) {
      lines = this.extract(pdfPage, page);
      this.cache.set(pdfPage, lines);
    }
    return lines;
  }

  private async extract(pdfPage: PDFPageProxy, page: PageRef): Promise<TextLine[]> {
    const content = await pdfPage.getTextContent();
    const styles = (content as { styles?: Record<string, PdfJsTextStyle> }).styles ?? {};
    const vt = page.viewportTransform;
    const scaleX = Math.hypot(vt[0], vt[1]);
    const items: RawTextItem[] = [];

    for (const raw of content.items) {
      if (!('str' in raw)) continue;
      const item = raw as PdfJsTextItem;
      if (!item.str.trim()) continue;
      const t = multiply(vt, item.transform as unknown as Matrix);
      // Solo se edita el texto horizontal
      if (Math.abs(t[1]) > 0.01 * Math.abs(t[0]) || t[0] <= 0) continue;
      const fontSize = Math.hypot(t[2], t[3]);
      if (!fontSize) continue;
      const style = styles[item.fontName] ?? {};
      items.push({
        text: item.str,
        x: t[4],
        baseline: t[5],
        width: item.width * scaleX,
        fontSize,
        fontName: item.fontName,
        fontRealName: this.realFontName(pdfPage, item.fontName),
        fontFamily: style.fontFamily ?? 'sans-serif',
        ascent: style.ascent && style.ascent > 0.2 ? style.ascent : DEFAULT_ASCENT,
        descent: style.descent ? Math.abs(style.descent) : DEFAULT_DESCENT,
      });
    }
    return groupTextItems(items);
  }

  /** Nombre real de la fuente, si pdf.js ya la ha cargado al pintar la página. */
  private realFontName(page: PDFPageProxy, fontName: string): string {
    try {
      const objs = (
        page as unknown as {
          commonObjs?: { has(id: string): boolean; get(id: string): { name?: string } };
        }
      ).commonObjs;
      return objs?.has(fontName) ? String(objs.get(fontName)?.name ?? '') : '';
    } catch {
      return '';
    }
  }
}
