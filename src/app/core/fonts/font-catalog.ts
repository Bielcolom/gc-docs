import type { FontDefinition, FontGroup, FontId } from '@core/models';

export const FONT_GROUP_LABELS: Readonly<Record<FontGroup, string>> = {
  classic: 'Clásicas',
  modern: 'Modernas',
  handwriting: 'Manuscritas',
};

export const FONTS: readonly FontDefinition[] = [
  {
    id: 'helvetica',
    label: 'Helvetica / Arial',
    group: 'classic',
    cssFamily: 'Helvetica, Arial, "Liberation Sans", sans-serif',
    standard: {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique',
      boldItalic: 'Helvetica-BoldOblique',
    },
    unicodeFallback: 'roboto',
  },
  {
    id: 'times',
    label: 'Times',
    group: 'classic',
    cssFamily: '"Times New Roman", Times, "Liberation Serif", serif',
    standard: {
      regular: 'Times-Roman',
      bold: 'Times-Bold',
      italic: 'Times-Italic',
      boldItalic: 'Times-BoldItalic',
    },
    unicodeFallback: 'lora',
  },
  {
    id: 'courier',
    label: 'Courier',
    group: 'classic',
    cssFamily: '"Courier New", Courier, "Liberation Mono", monospace',
    standard: {
      regular: 'Courier',
      bold: 'Courier-Bold',
      italic: 'Courier-Oblique',
      boldItalic: 'Courier-BoldOblique',
    },
    unicodeFallback: 'roboto-mono',
  },
  {
    id: 'roboto',
    label: 'Roboto',
    group: 'modern',
    cssFamily: '"GC Roboto", sans-serif',
    files: {
      regular: 'Roboto_400Regular.ttf',
      bold: 'Roboto_700Bold.ttf',
      italic: 'Roboto_400Regular_Italic.ttf',
      boldItalic: 'Roboto_700Bold_Italic.ttf',
    },
  },
  {
    id: 'lora',
    label: 'Lora',
    group: 'modern',
    cssFamily: '"GC Lora", serif',
    files: {
      regular: 'Lora_400Regular.ttf',
      bold: 'Lora_700Bold.ttf',
      italic: 'Lora_400Regular_Italic.ttf',
      boldItalic: 'Lora_700Bold_Italic.ttf',
    },
  },
  {
    id: 'roboto-mono',
    label: 'Roboto Mono',
    group: 'modern',
    cssFamily: '"GC Roboto Mono", monospace',
    files: {
      regular: 'RobotoMono_400Regular.ttf',
      bold: 'RobotoMono_700Bold.ttf',
      italic: 'RobotoMono_400Regular_Italic.ttf',
      boldItalic: 'RobotoMono_700Bold_Italic.ttf',
    },
  },
  {
    id: 'dancing',
    label: 'Dancing Script',
    group: 'handwriting',
    cssFamily: '"GC Dancing", cursive',
    files: { regular: 'DancingScript_400Regular.ttf', bold: 'DancingScript_700Bold.ttf' },
  },
  {
    id: 'great-vibes',
    label: 'Great Vibes',
    group: 'handwriting',
    cssFamily: '"GC Great Vibes", cursive',
    files: { regular: 'GreatVibes_400Regular.ttf' },
  },
  {
    id: 'caveat',
    label: 'Caveat',
    group: 'handwriting',
    cssFamily: '"GC Caveat", cursive',
    files: { regular: 'Caveat_400Regular.ttf', bold: 'Caveat_700Bold.ttf' },
  },
];

const FONT_MAP = new Map<FontId, FontDefinition>(FONTS.map((f) => [f.id, f]));

export function getFont(id: FontId): FontDefinition {
  const font = FONT_MAP.get(id);
  if (!font) throw new Error(`Fuente desconocida: ${id}`);
  return font;
}

/** Archivo TTF de la variante pedida, o la más parecida disponible. */
export function fontFileFor(
  font: FontDefinition,
  bold: boolean,
  italic: boolean,
): string | undefined {
  const f = font.files;
  if (!f) return undefined;
  if (bold && italic) return f.boldItalic ?? f.bold ?? f.italic ?? f.regular;
  if (bold) return f.bold ?? f.regular;
  if (italic) return f.italic ?? f.regular;
  return f.regular;
}

/** Primera familia de la pila CSS, sin comillas. */
export function primaryFamily(font: FontDefinition): string {
  return font.cssFamily.split(',')[0].replace(/"/g, '').trim();
}
