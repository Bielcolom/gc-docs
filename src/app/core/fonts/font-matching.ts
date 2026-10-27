import type { FontStyle } from '@core/models';

/** Elige la fuente estándar más parecida a la fuente original de un PDF. */
export function guessFontStyle(fontName: string, family: string): FontStyle {
  const name = `${fontName} ${family}`.toLowerCase();
  const bold = /bold|black|heavy|semibold|demi|-bd\b|,bd\b/.test(name);
  const italic = /italic|oblique|-it\b|,it\b/.test(name);
  if (/courier|mono|consol|menlo/.test(name)) return { font: 'courier', bold, italic };
  if (
    /times|serif|georgia|garamond|cambria|book|minion|palatino|roman/.test(name) &&
    !/sans/.test(name)
  ) {
    return { font: 'times', bold, italic };
  }
  return { font: 'helvetica', bold, italic };
}
