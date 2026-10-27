import { DEFAULT_PAGE_NUMBERS } from '@core/constants';
import { baseName, formatPageNumber, normalizeForSearch, pageNumberLabel } from './text.utils';

describe('text.utils', () => {
  it('baseName quita solo la última extensión', () => {
    expect(baseName('informe.final.pdf')).toBe('informe.final');
    expect(baseName('sin-extension')).toBe('sin-extension');
  });

  it('normalizeForSearch ignora mayúsculas y tildes', () => {
    expect(normalizeForSearch('Cláusula ÚNICA')).toBe(normalizeForSearch('clausula unica'));
  });

  it('formatPageNumber sustituye {n} y {total}', () => {
    expect(formatPageNumber('Página {n} de {total}', 2, 9)).toBe('Página 2 de 9');
  });

  describe('pageNumberLabel', () => {
    const settings = { ...DEFAULT_PAGE_NUMBERS, enabled: true, format: '{n}/{total}', startAt: 1 };

    it('no numera si está desactivado', () => {
      expect(pageNumberLabel({ ...settings, enabled: false }, 0, 3)).toBeNull();
    });

    it('numera desde el valor inicial', () => {
      expect(pageNumberLabel(settings, 0, 3)).toBe('1/3');
      expect(pageNumberLabel({ ...settings, startAt: 10 }, 1, 3)).toBe('11/12');
    });

    it('puede saltarse la portada sin contarla', () => {
      const skip = { ...settings, skipFirst: true };
      expect(pageNumberLabel(skip, 0, 3)).toBeNull();
      expect(pageNumberLabel(skip, 1, 3)).toBe('1/2');
    });
  });
});
