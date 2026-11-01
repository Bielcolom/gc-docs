import type { FontId } from '@core/models';
import { colorDistance, hexToRgb01, type Rgb } from '@core/utils';

/**
 * Familias que Google Docs ofrece de serie. Si la fuente del PDF es una de ellas se conserva; si no,
 * se usa la estándar más parecida, para que Docs no la sustituya por otra al importar.
 */
const DOCS_FONTS = [
  'Arial',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Courier New',
  'EB Garamond',
  'Garamond',
  'Georgia',
  'Impact',
  'Inter',
  'Lato',
  'Lora',
  'Merriweather',
  'Montserrat',
  'Noto Sans',
  'Noto Serif',
  'Nunito',
  'Open Sans',
  'Oswald',
  'Playfair Display',
  'Poppins',
  'PT Sans',
  'PT Serif',
  'Raleway',
  'Roboto Mono',
  'Roboto Slab',
  'Roboto',
  'Source Sans Pro',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Ubuntu',
  'Verdana',
] as const;

/** Nombres que usan los PDF para las fuentes básicas. */
const ALIASES: Readonly<Record<string, string>> = {
  helvetica: 'Arial',
  arialmt: 'Arial',
  liberationsans: 'Arial',
  arimo: 'Arial',
  times: 'Times New Roman',
  liberationserif: 'Times New Roman',
  tinos: 'Times New Roman',
  courier: 'Courier New',
  liberationmono: 'Courier New',
  cousine: 'Courier New',
  carlito: 'Calibri',
  caladea: 'Cambria',
  segoeui: 'Open Sans',
  sourcesans3: 'Source Sans Pro',
};

const FALLBACK: Readonly<Record<'helvetica' | 'times' | 'courier', string>> = {
  helvetica: 'Arial',
  times: 'Times New Roman',
  courier: 'Courier New',
};

const squash = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

// Los nombres más largos primero, para que "Roboto Mono" gane a "Roboto".
const CANDIDATES = [
  ...DOCS_FONTS.map((font) => [squash(font), font] as const),
  ...Object.entries(ALIASES),
].sort((a, b) => b[0].length - a[0].length);

/**
 * Familia de Google Docs para una fuente del PDF.
 * @param realName Nombre real de la fuente (p. ej. "ABCDEF+Calibri-Bold").
 * @param kind Estilo estándar más parecido, por si el nombre no se reconoce.
 */
export function docsFontFamily(realName: string, kind: FontId): string {
  const name = squash(realName.replace(/^[A-Z]{6}\+/, ''));
  const match = name && CANDIDATES.find(([key]) => name.startsWith(key));
  if (match) return match[1];
  return kind === 'times' || kind === 'courier' ? FALLBACK[kind] : FALLBACK.helvetica;
}

/** Por debajo de esto un color sin apenas tono se trata como negro. */
const NEAR_BLACK = 0.3;
const MAX_GREY_SPREAD = 0.1;
/** Con menos contraste que esto sobre blanco, el texto apenas se lee (un gris #999 tiene 2,8). */
const MIN_CONTRAST_ON_WHITE = 2;

/**
 * Color de texto para el documento, sin `#`. Los casi negros (antialiasing) se quedan en negro, y
 * también los que no se leerían sobre blanco: estaban sobre un fondo de color (una franja, un
 * recuadro) que no pasa al documento.
 */
export function docsTextColor(hex: string): string {
  const [r, g, b] = hexToRgb01(hex);
  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  if (max < NEAR_BLACK && spread < MAX_GREY_SPREAD) return '000000';
  if (contrastOnWhite(r, g, b) < MIN_CONTRAST_ON_WHITE) return '000000';
  return hex.replace('#', '').toLowerCase();
}

/** Contraste WCAG de un color sobre blanco (de 1 a 21). */
function contrastOnWhite(r: number, g: number, b: number): number {
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return 1.05 / (luminance + 0.05);
}

/** Distancia (0–765) por debajo de la cual dos colores muestreados son el mismo. */
const SAME_COLOR = 24;

/**
 * Colores del documento. El muestreo del render da tonos ligeramente distintos para un mismo
 * color (p. ej. "23509e" y "244f9d"); la paleta los unifica con el primero que aparece.
 */
export class ColorPalette {
  private readonly known: { readonly hex: string; readonly rgb: Rgb }[] = [];

  normalize(hex: string): string {
    const rgb = hexToRgb01(hex).map((c) => c * 255) as unknown as Rgb;
    const match = this.known.find((color) => colorDistance(color.rgb, rgb) <= SAME_COLOR);
    if (match) return match.hex;
    this.known.push({ hex, rgb });
    return hex;
  }
}
