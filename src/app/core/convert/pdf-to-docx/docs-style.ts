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
/** Texto tan claro solo se lee sobre un fondo oscuro, que no pasa al documento. */
const TOO_LIGHT = 0.82;

/**
 * Color de texto para el documento, sin `#`. Los casi negros (antialiasing) se quedan en negro y los
 * muy claros también, porque el fondo oscuro sobre el que estaban no se conserva y serían invisibles.
 */
export function docsTextColor(hex: string): string {
  const [r, g, b] = hexToRgb01(hex);
  const max = Math.max(r, g, b);
  const spread = max - Math.min(r, g, b);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if ((max < NEAR_BLACK && spread < MAX_GREY_SPREAD) || luminance > TOO_LIGHT) return '000000';
  return hex.replace('#', '').toLowerCase();
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
