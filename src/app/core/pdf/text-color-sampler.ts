import type { Rect } from '@core/models';
import { colorDistance, rgbToHex, type Rgb } from '@core/utils';
import type { SampledColors } from '@core/annotations';

const FALLBACK: SampledColors = { text: '#111418', background: '#ffffff' };
/** Si apenas hay contraste, el texto no se distingue del fondo. */
const MIN_CONTRAST = 40;
/** Píxeles "de texto": los más alejados del color de fondo. */
const TEXT_PIXEL_RATIO = 0.75;
const NEAR_WHITE = 240;

/**
 * Detecta el color del texto y del fondo de una zona ya dibujada en un lienzo.
 * El fondo es el color más frecuente en el borde; el texto, la media de los píxeles más distintos.
 * @param area Zona en puntos PDF. @param pageWidth Ancho de la página en puntos (para la escala).
 */
export function sampleTextColors(
  canvas: HTMLCanvasElement,
  area: Rect,
  pageWidth: number,
): SampledColors {
  if (!canvas.width) return FALLBACK;
  const k = canvas.width / pageWidth;
  const sx = Math.max(0, Math.floor((area.x - 2) * k));
  const sy = Math.max(0, Math.floor((area.y - 2) * k));
  const sw = Math.min(canvas.width - sx, Math.ceil((area.w + 4) * k));
  const sh = Math.min(canvas.height - sy, Math.ceil((area.h + 4) * k));
  if (sw <= 2 || sh <= 2) return FALLBACK;

  let data: Uint8ClampedArray;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return FALLBACK;
    data = ctx.getImageData(sx, sy, sw, sh).data;
  } catch {
    return FALLBACK;
  }

  const pixel = (i: number): Rgb => [data[i], data[i + 1], data[i + 2]];
  const background = dominantBorderColor(data, sw, sh);
  let maxDistance = 0;
  for (let i = 0; i < data.length; i += 4)
    maxDistance = Math.max(maxDistance, colorDistance(pixel(i), background));

  const backgroundHex = background.every((c) => c > NEAR_WHITE)
    ? '#ffffff'
    : rgbToHex(...background);
  if (maxDistance < MIN_CONTRAST) return { text: FALLBACK.text, background: backgroundHex };

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const c = pixel(i);
    if (colorDistance(c, background) > maxDistance * TEXT_PIXEL_RATIO) {
      r += c[0];
      g += c[1];
      b += c[2];
      count++;
    }
  }
  return {
    text: count ? rgbToHex(r / count, g / count, b / count) : FALLBACK.text,
    background: backgroundHex,
  };
}

/** Color más repetido en el contorno de la zona (cuantizado a 5 bits por canal). */
function dominantBorderColor(data: Uint8ClampedArray, width: number, height: number): Rgb {
  const counts = new Map<number, number>();
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < width; x++) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    add(0, y);
    add(width - 1, y);
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return [((best >> 10) & 31) * 8 + 4, ((best >> 5) & 31) * 8 + 4, (best & 31) * 8 + 4];
}
