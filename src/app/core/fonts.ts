import { FontId } from './models';

export interface FontDef {
  id: FontId;
  label: string;
  /** familia CSS para mostrarlo en pantalla */
  css: string;
  /** Fuente estándar PDF (sin incrustar). Solo admite caracteres de Europa occidental. */
  standard?: { regular: string; bold: string; italic: string; boldItalic: string };
  /** Archivos TTF incrustables (dentro de /fonts). */
  files?: { regular: string; bold?: string; italic?: string; boldItalic?: string };
  /** Fuente incrustable equivalente cuando el texto lleva caracteres fuera de WinAnsi. */
  unicodeFallback?: FontId;
  group: 'Clásicas' | 'Modernas' | 'Manuscritas';
}

export const FONTS: FontDef[] = [
  {
    id: 'helvetica',
    label: 'Helvetica / Arial',
    css: 'Helvetica, Arial, "Liberation Sans", sans-serif',
    standard: { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', boldItalic: 'Helvetica-BoldOblique' },
    unicodeFallback: 'roboto',
    group: 'Clásicas',
  },
  {
    id: 'times',
    label: 'Times',
    css: '"Times New Roman", Times, "Liberation Serif", serif',
    standard: { regular: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic', boldItalic: 'Times-BoldItalic' },
    unicodeFallback: 'lora',
    group: 'Clásicas',
  },
  {
    id: 'courier',
    label: 'Courier',
    css: '"Courier New", Courier, "Liberation Mono", monospace',
    standard: { regular: 'Courier', bold: 'Courier-Bold', italic: 'Courier-Oblique', boldItalic: 'Courier-BoldOblique' },
    unicodeFallback: 'roboto-mono',
    group: 'Clásicas',
  },
  {
    id: 'roboto',
    label: 'Roboto',
    css: '"GC Roboto", sans-serif',
    files: {
      regular: 'Roboto_400Regular.ttf',
      bold: 'Roboto_700Bold.ttf',
      italic: 'Roboto_400Regular_Italic.ttf',
      boldItalic: 'Roboto_700Bold_Italic.ttf',
    },
    group: 'Modernas',
  },
  {
    id: 'lora',
    label: 'Lora',
    css: '"GC Lora", serif',
    files: {
      regular: 'Lora_400Regular.ttf',
      bold: 'Lora_700Bold.ttf',
      italic: 'Lora_400Regular_Italic.ttf',
      boldItalic: 'Lora_700Bold_Italic.ttf',
    },
    group: 'Modernas',
  },
  {
    id: 'roboto-mono',
    label: 'Roboto Mono',
    css: '"GC Roboto Mono", monospace',
    files: {
      regular: 'RobotoMono_400Regular.ttf',
      bold: 'RobotoMono_700Bold.ttf',
      italic: 'RobotoMono_400Regular_Italic.ttf',
      boldItalic: 'RobotoMono_700Bold_Italic.ttf',
    },
    group: 'Modernas',
  },
  {
    id: 'dancing',
    label: 'Dancing Script',
    css: '"GC Dancing", cursive',
    files: { regular: 'DancingScript_400Regular.ttf', bold: 'DancingScript_700Bold.ttf' },
    group: 'Manuscritas',
  },
  {
    id: 'greatvibes',
    label: 'Great Vibes',
    css: '"GC Great Vibes", cursive',
    files: { regular: 'GreatVibes_400Regular.ttf' },
    group: 'Manuscritas',
  },
  {
    id: 'caveat',
    label: 'Caveat',
    css: '"GC Caveat", cursive',
    files: { regular: 'Caveat_400Regular.ttf', bold: 'Caveat_700Bold.ttf' },
    group: 'Manuscritas',
  },
];

export const FONT_MAP: Record<FontId, FontDef> = Object.fromEntries(FONTS.map((f) => [f.id, f])) as Record<FontId, FontDef>;

export function fontFile(def: FontDef, bold: boolean, italic: boolean): string | undefined {
  const f = def.files;
  if (!f) return undefined;
  if (bold && italic) return f.boldItalic ?? f.bold ?? f.italic ?? f.regular;
  if (bold) return f.bold ?? f.regular;
  if (italic) return f.italic ?? f.regular;
  return f.regular;
}

/** Registra @font-face para las fuentes incrustables, para que el texto en pantalla coincida con el PDF. */
export function registerWebFonts(baseHref: string): void {
  const rules: string[] = [];
  for (const def of FONTS) {
    if (!def.files) continue;
    const family = def.css.split(',')[0].trim();
    const variants: [string | undefined, number, string][] = [
      [def.files.regular, 400, 'normal'],
      [def.files.bold, 700, 'normal'],
      [def.files.italic, 400, 'italic'],
      [def.files.boldItalic, 700, 'italic'],
    ];
    for (const [file, weight, style] of variants) {
      if (!file) continue;
      rules.push(
        `@font-face{font-family:${family};src:url("${baseHref}fonts/${file}") format("truetype");font-weight:${weight};font-style:${style};font-display:swap;}`,
      );
    }
  }
  const el = document.createElement('style');
  el.textContent = rules.join('\n');
  document.head.appendChild(el);
}

const metricsCache = new Map<string, { ascent: number; descent: number }>();

/**
 * Métricas reales de la fuente tal y como la dibuja el navegador (proporción del tamaño).
 * Se usan para colocar la línea base en el PDF exactamente donde se ve en pantalla.
 */
export function fontMetrics(font: FontId, bold: boolean, italic: boolean): { ascent: number; descent: number } {
  const key = `${font}|${bold}|${italic}`;
  const hit = metricsCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}100px ${FONT_MAP[font].css}`;
  const m = ctx.measureText('Hgjy');
  const ascent = (m.fontBoundingBoxAscent ?? 90) / 100;
  const descent = (m.fontBoundingBoxDescent ?? 22) / 100;
  const res = { ascent, descent };
  // Solo cacheamos cuando la fuente ya está cargada, si no las métricas serían las de la fuente de reserva.
  const family = FONT_MAP[font].css.split(',')[0].replace(/"/g, '').trim();
  if (!FONT_MAP[font].files || document.fonts.check(`100px "${family}"`)) metricsCache.set(key, res);
  return res;
}

export const LINE_HEIGHT = 1.2;

/** Distancia desde la parte superior de la caja de una línea hasta su línea base. */
export function baselineOffset(font: FontId, bold: boolean, italic: boolean, size: number): number {
  const { ascent, descent } = fontMetrics(font, bold, italic);
  const lh = size * LINE_HEIGHT;
  return (lh - (ascent + descent) * size) / 2 + ascent * size;
}

/** Fuente estándar más parecida a la fuente original del PDF. */
export function guessFont(name: string, family: string): { font: FontId; bold: boolean; italic: boolean } {
  const n = `${name} ${family}`.toLowerCase();
  const bold = /bold|black|heavy|semibold|demi|-bd|,bd/.test(n);
  const italic = /italic|oblique|-it\b|,it\b/.test(n);
  let font: FontId = 'helvetica';
  if (/courier|mono|consol|menlo/.test(n)) font = 'courier';
  else if (/times|serif|georgia|garamond|cambria|book|minion|palatino|roman/.test(n) && !/sans/.test(n)) font = 'times';
  return { font, bold, italic };
}
