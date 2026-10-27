import { guessFontStyle } from './font-matching';

describe('guessFontStyle', () => {
  it.each([
    ['ABCDEF+Helvetica-Bold', 'sans-serif', { font: 'helvetica', bold: true, italic: false }],
    ['TimesNewRomanPS-ItalicMT', 'serif', { font: 'times', bold: false, italic: true }],
    ['Georgia', 'serif', { font: 'times', bold: false, italic: false }],
    ['CourierNewPS-BoldItalicMT', 'monospace', { font: 'courier', bold: true, italic: true }],
    ['OpenSans-Regular', 'sans-serif', { font: 'helvetica', bold: false, italic: false }],
    ['NotoSerif-SemiBold', 'serif', { font: 'times', bold: true, italic: false }],
  ])('%s → %o', (fontName, family, expected) => {
    expect(guessFontStyle(fontName, family)).toEqual(expected);
  });
});
