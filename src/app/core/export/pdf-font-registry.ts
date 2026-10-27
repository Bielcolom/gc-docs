import { getFont, fontFileFor } from '@core/fonts';
import type { FontDefinition, FontId } from '@core/models';
import type { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';

/** Fuentes incrustadas en un PDF que se está generando (cada variante se incrusta una sola vez). */
export class PdfFontRegistry {
  private readonly cache = new Map<string, Promise<PDFFont>>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly loadFile: (fileName: string) => Promise<ArrayBuffer>,
  ) {}

  get(font: FontDefinition, bold: boolean, italic: boolean): Promise<PDFFont> {
    const key = `${font.id}|${bold}|${italic}`;
    let embedded = this.cache.get(key);
    if (!embedded) {
      embedded = font.standard
        ? this.doc.embedFont(this.standardName(font, bold, italic) as StandardFonts)
        : this.loadFile(fontFileFor(font, bold, italic) ?? '').then((bytes) =>
            // Sin subconjunto: fontkit pierde glifos al recortar algunas fuentes
            this.doc.embedFont(bytes, { subset: false }),
          );
      this.cache.set(key, embedded);
    }
    return embedded;
  }

  /**
   * Fuente capaz de representar `text`. Las fuentes estándar de PDF solo admiten WinAnsi;
   * si el texto lleva otros caracteres se usa su equivalente Unicode incrustado.
   */
  async forText(fontId: FontId, bold: boolean, italic: boolean, text: string): Promise<PDFFont> {
    const definition = getFont(fontId);
    const font = await this.get(definition, bold, italic);
    if (!definition.standard) return font;
    try {
      font.encodeText(text);
      return font;
    } catch {
      return this.get(getFont(definition.unicodeFallback ?? 'roboto'), bold, italic);
    }
  }

  private standardName(font: FontDefinition, bold: boolean, italic: boolean): string {
    const s = font.standard!;
    if (bold && italic) return s.boldItalic;
    if (bold) return s.bold;
    if (italic) return s.italic;
    return s.regular;
  }
}
