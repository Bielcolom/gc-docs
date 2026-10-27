import { LINE_HEIGHT, getFont } from '@core/fonts';
import type {
  Annotation,
  HighlightAnnotation,
  PathAnnotation,
  ShapeAnnotation,
  StampAnnotation,
  SymbolAnnotation,
  TextAnnotation,
  FontId,
} from '@core/models';
import {
  SYMBOL_STROKES,
  absolutePoints,
  arrowHead,
  hexToRgb01,
  linePath,
  polylinePath,
  roundedRectPath,
  smoothPath,
} from '@core/utils';
import {
  BlendMode,
  LineCapStyle,
  degrees,
  rgb,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import type { PdfFontRegistry } from './pdf-font-registry';

export const toRgb = (hex: string): RGB => {
  const [r, g, b] = hexToRgb01(hex);
  return rgb(r, g, b);
};

const HIGHLIGHT_OPACITY = 0.45;
const STAMP_TEXT_RATIO = 0.46;
const STAMP_MAX_TEXT_WIDTH = 0.84;
const CAP_HEIGHT = 0.72;
const FAKE_ITALIC_SKEW = 12;

export interface PainterContext {
  readonly page: PDFPage;
  /** Alto del espacio en el que se dibuja (eje Y hacia arriba). */
  readonly height: number;
  readonly fonts: PdfFontRegistry;
  readonly embedImage: (src: string) => Promise<PDFImage>;
  readonly baselineOffset: (font: FontId, bold: boolean, italic: boolean, size: number) => number;
}

/**
 * Dibuja anotaciones con pdf-lib. Recibe coordenadas del espacio base (Y hacia abajo)
 * y las convierte a Y hacia arriba; el cambio al espacio PDF lo hace una matriz previa.
 */
export class AnnotationPainter {
  constructor(private readonly ctx: PainterContext) {}

  async paint(a: Annotation): Promise<void> {
    switch (a.type) {
      case 'text':
        return this.text(a);
      case 'rect':
      case 'ellipse':
        return this.shape(a);
      case 'line':
      case 'arrow':
      case 'ink':
        return this.path(a);
      case 'highlight':
        return this.highlight(a);
      case 'image':
        return this.image(a.src, a.x, a.y, a.w, a.h, a.opacity);
      case 'stamp':
        return this.stamp(a);
      case 'symbol':
        return this.symbol(a);
      case 'note':
        // Los comentarios se añaden como anotaciones PDF nativas, no se dibujan
        return;
    }
  }

  private up(y: number): number {
    return this.ctx.height - y;
  }

  private svg(d: string, options: Parameters<PDFPage['drawSvgPath']>[1]): void {
    // drawSvgPath usa el eje Y hacia abajo con origen en (x, y)
    this.ctx.page.drawSvgPath(d, { x: 0, y: this.ctx.height, ...options });
  }

  private async text(a: TextAnnotation): Promise<void> {
    const { page } = this.ctx;
    if (a.cover) {
      page.drawRectangle({
        x: a.cover.x,
        y: this.up(a.cover.y + a.cover.h),
        width: a.cover.w,
        height: a.cover.h,
        color: toRgb(a.cover.color),
      });
    }
    if (a.background) {
      page.drawRectangle({
        x: a.x,
        y: this.up(a.y + a.h),
        width: a.w,
        height: a.h,
        color: toRgb(a.background),
        opacity: a.opacity,
      });
    }
    const text = a.text.replace(/\r/g, '');
    if (!text.trim()) return;

    const font = await this.ctx.fonts.forText(a.font, a.bold, a.italic, text);
    const definition = getFont(a.font);
    const fakeItalic = a.italic && !definition.standard && !definition.files?.italic;
    const lineHeight = a.size * LINE_HEIGHT;
    const baseline = this.ctx.baselineOffset(a.font, a.bold, a.italic, a.size);
    const color = toRgb(a.color);

    text.split('\n').forEach((line, i) => {
      if (!line) return;
      const width = font.widthOfTextAtSize(line, a.size);
      const dx = a.align === 'center' ? (a.w - width) / 2 : a.align === 'right' ? a.w - width : 0;
      const x = a.x + dx;
      const y = a.y + i * lineHeight + baseline;
      page.drawText(line, {
        x,
        y: this.up(y),
        size: a.size,
        font,
        color,
        opacity: a.opacity,
        xSkew: fakeItalic ? degrees(FAKE_ITALIC_SKEW) : undefined,
      });
      if (a.underline) {
        const thickness = Math.max(0.6, a.size / 16);
        page.drawRectangle({
          x,
          y: this.up(y + a.size * 0.12 + thickness),
          width,
          height: thickness,
          color,
          opacity: a.opacity,
        });
      }
    });
  }

  private shape(a: ShapeAnnotation): void {
    const options = {
      color: a.fill ? toRgb(a.fill) : undefined,
      borderColor: a.stroke ? toRgb(a.stroke) : undefined,
      borderWidth: a.stroke ? a.strokeWidth : 0,
      opacity: a.opacity,
      borderOpacity: a.opacity,
    };
    if (a.type === 'rect') {
      this.ctx.page.drawRectangle({
        x: a.x,
        y: this.up(a.y + a.h),
        width: a.w,
        height: a.h,
        ...options,
      });
    } else {
      this.ctx.page.drawEllipse({
        x: a.x + a.w / 2,
        y: this.up(a.y + a.h / 2),
        xScale: a.w / 2,
        yScale: a.h / 2,
        ...options,
      });
    }
  }

  private path(a: PathAnnotation): void {
    const points = absolutePoints(a);
    const tuples = points.map((p) => [p.x, p.y] as const);
    const d = a.type === 'ink' ? smoothPath(tuples) : linePath(tuples[0], tuples[1]);
    this.svg(d, {
      borderColor: toRgb(a.stroke),
      borderWidth: a.strokeWidth,
      borderOpacity: a.opacity,
      borderLineCap: LineCapStyle.Round,
    });
    if (a.type === 'arrow') {
      const head = arrowHead(points[0], points[1], a.strokeWidth);
      this.svg(polylinePath(head, true), { color: toRgb(a.stroke), opacity: a.opacity });
    }
  }

  private highlight(a: HighlightAnnotation): void {
    const color = toRgb(a.color);
    if (a.mode === 'highlight') {
      this.ctx.page.drawRectangle({
        x: a.x,
        y: this.up(a.y + a.h),
        width: a.w,
        height: a.h,
        color,
        opacity: HIGHLIGHT_OPACITY * a.opacity,
        blendMode: BlendMode.Multiply,
      });
      return;
    }
    const thickness = Math.max(1.2, a.h * 0.08);
    const top = a.mode === 'underline' ? a.y + a.h - thickness : a.y + a.h / 2 - thickness / 2;
    this.ctx.page.drawRectangle({
      x: a.x,
      y: this.up(top + thickness),
      width: a.w,
      height: thickness,
      color,
      opacity: a.opacity,
    });
  }

  private async image(
    src: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opacity: number,
  ): Promise<void> {
    const image = await this.ctx.embedImage(src);
    this.ctx.page.drawImage(image, { x, y: this.up(y + h), width: w, height: h, opacity });
  }

  private async stamp(a: StampAnnotation): Promise<void> {
    const color = toRgb(a.color);
    const border = Math.max(1.5, a.h * 0.07);
    this.svg(
      roundedRectPath(a.x + border / 2, a.y + border / 2, a.w - border, a.h - border, a.h * 0.18),
      {
        borderColor: color,
        borderWidth: border,
        borderOpacity: a.opacity,
      },
    );
    const font = await this.ctx.fonts.forText('helvetica', true, false, a.label);
    let size = a.h * STAMP_TEXT_RATIO;
    const maxWidth = a.w * STAMP_MAX_TEXT_WIDTH;
    const measured = font.widthOfTextAtSize(a.label, size);
    if (measured > maxWidth) size *= maxWidth / measured;
    const width = font.widthOfTextAtSize(a.label, size);
    this.ctx.page.drawText(a.label, {
      x: a.x + (a.w - width) / 2,
      y: this.up(a.y + a.h / 2 + (size * CAP_HEIGHT) / 2),
      size,
      font,
      color,
      opacity: a.opacity,
    });
  }

  private symbol(a: SymbolAnnotation): void {
    const color = toRgb(a.color);
    if (a.kind === 'dot') {
      this.ctx.page.drawEllipse({
        x: a.x + a.w / 2,
        y: this.up(a.y + a.h / 2),
        xScale: a.w * 0.32,
        yScale: a.h * 0.32,
        color,
        opacity: a.opacity,
      });
      return;
    }
    const width = Math.min(a.w, a.h) * 0.13;
    for (const stroke of SYMBOL_STROKES[a.kind]) {
      const points = stroke.map(([px, py]) => [a.x + px * a.w, a.y + py * a.h] as const);
      this.svg(polylinePath(points), {
        borderColor: color,
        borderWidth: width,
        borderOpacity: a.opacity,
        borderLineCap: LineCapStyle.Round,
      });
    }
  }
}
