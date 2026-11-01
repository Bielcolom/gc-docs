import { ColorPalette, docsFontFamily, docsTextColor } from './docs-style';

describe('docsFontFamily', () => {
  it('conserva las fuentes que Google Docs tiene', () => {
    expect(docsFontFamily('ABCDEF+Calibri-Bold', 'helvetica')).toBe('Calibri');
    expect(docsFontFamily('Georgia-Italic', 'times')).toBe('Georgia');
  });

  it('elige la variante más concreta', () => {
    expect(docsFontFamily('RobotoMono-Regular', 'courier')).toBe('Roboto Mono');
    expect(docsFontFamily('Roboto-Medium', 'helvetica')).toBe('Roboto');
  });

  it('traduce los nombres de las fuentes básicas de PDF', () => {
    expect(docsFontFamily('Helvetica-Bold', 'helvetica')).toBe('Arial');
    expect(docsFontFamily('TimesNewRomanPSMT', 'times')).toBe('Times New Roman');
    expect(docsFontFamily('Times-Roman', 'times')).toBe('Times New Roman');
    expect(docsFontFamily('Courier', 'courier')).toBe('Courier New');
  });

  it('usa la estándar más parecida si no reconoce la fuente', () => {
    expect(docsFontFamily('CMR10', 'times')).toBe('Times New Roman');
    expect(docsFontFamily('', 'helvetica')).toBe('Arial');
  });
});

describe('docsTextColor', () => {
  it('deja en negro los casi negros del suavizado', () => {
    expect(docsTextColor('#1b1d20')).toBe('000000');
  });

  it('conserva los colores con tono', () => {
    expect(docsTextColor('#1F4E9A')).toBe('1f4e9a');
    expect(docsTextColor('#b3261e')).toBe('b3261e');
  });

  it('pasa a negro el texto que no se leería sobre blanco (estaba sobre un fondo de color)', () => {
    expect(docsTextColor('#ffffff')).toBe('000000');
    expect(docsTextColor('#ffbc7e')).toBe('000000');
  });

  it('conserva los grises claros que aún se leen', () => {
    expect(docsTextColor('#999999')).toBe('999999');
  });
});

describe('ColorPalette', () => {
  it('unifica los tonos casi iguales con el primero que aparece', () => {
    const palette = new ColorPalette();
    expect(palette.normalize('23509e')).toBe('23509e');
    expect(palette.normalize('244f9d')).toBe('23509e');
    expect(palette.normalize('b3261e')).toBe('b3261e');
  });
});
