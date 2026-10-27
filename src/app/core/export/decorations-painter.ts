import { PAGE_NUMBER_MARGIN } from '@core/constants';
import type { PageNumberSettings, Size, WatermarkSettings } from '@core/models';
import { degrees, type PDFPage } from 'pdf-lib';
import { toRgb } from './annotation-painter';
import type { PdfFontRegistry } from './pdf-font-registry';

const CAP_HEIGHT = 0.72;

/** Marca de agua centrada y girada (en el espacio "tal y como se ve", eje Y hacia arriba). */
export async function paintWatermark(
  page: PDFPage,
  size: Size,
  settings: WatermarkSettings,
  fonts: PdfFontRegistry,
): Promise<void> {
  if (!settings.enabled || !settings.text.trim()) return;
  const font = await fonts.forText('helvetica', true, false, settings.text);
  const textWidth = font.widthOfTextAtSize(settings.text, settings.size);
  const capHeight = font.heightAtSize(settings.size, { descender: false }) * CAP_HEIGHT;
  const angle = (settings.angle * Math.PI) / 180;
  // Origen tal que el centro del texto girado coincida con el centro de la página
  const x = size.w / 2 - ((textWidth / 2) * Math.cos(angle) - (capHeight / 2) * Math.sin(angle));
  const y = size.h / 2 - ((textWidth / 2) * Math.sin(angle) + (capHeight / 2) * Math.cos(angle));
  page.drawText(settings.text, {
    x,
    y,
    size: settings.size,
    font,
    color: toRgb(settings.color),
    opacity: settings.opacity,
    rotate: degrees(settings.angle),
  });
}

/** Número que se muestra en la página `index` (base 0), o `null` si no se numera. */
export async function paintPageNumber(
  page: PDFPage,
  size: Size,
  settings: PageNumberSettings,
  label: string,
  fonts: PdfFontRegistry,
): Promise<void> {
  const font = await fonts.forText('helvetica', false, false, label);
  const width = font.widthOfTextAtSize(label, settings.size);
  const [vertical, horizontal] = settings.position.split('-');
  const x =
    horizontal === 'left'
      ? PAGE_NUMBER_MARGIN
      : horizontal === 'right'
        ? size.w - PAGE_NUMBER_MARGIN - width
        : (size.w - width) / 2;
  const y =
    vertical === 'bottom'
      ? PAGE_NUMBER_MARGIN
      : size.h - PAGE_NUMBER_MARGIN - settings.size * CAP_HEIGHT;
  page.drawText(label, { x, y, size: settings.size, font, color: toRgb(settings.color) });
}
