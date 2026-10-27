import type { RawTextItem } from '@core/models';
import { charX, findInLine, groupTextItems } from './text-layout.utils';

const item = (
  text: string,
  x: number,
  baseline: number,
  width = text.length * 6,
  fontSize = 12,
): RawTextItem => ({
  text,
  x,
  baseline,
  width,
  fontSize,
  fontName: 'g_d0_f1',
  fontRealName: 'Helvetica',
  fontFamily: 'sans-serif',
  ascent: 0.8,
  descent: -0.2,
});

describe('text-layout.utils', () => {
  it('une los fragmentos del mismo renglón y añade el espacio que falta', () => {
    const [line] = groupTextItems([item('Hola', 10, 100), item('mundo', 10 + 24 + 4, 100)]);
    expect(line.text).toBe('Hola mundo');
    expect(line.segments).toHaveLength(2);
  });

  it('separa renglones distintos y los ordena de arriba abajo', () => {
    const lines = groupTextItems([item('segunda', 10, 130), item('primera', 10, 100)]);
    expect(lines.map((l) => l.text)).toEqual(['primera', 'segunda']);
  });

  it('separa columnas alejadas en líneas distintas', () => {
    const lines = groupTextItems([item('izquierda', 10, 100), item('derecha', 400, 100)]);
    expect(lines).toHaveLength(2);
  });

  it('charX interpola la posición dentro de un fragmento', () => {
    const [line] = groupTextItems([item('abcd', 0, 100, 40)]);
    expect(charX(line, 2)).toBe(20);
  });

  it('findInLine encuentra todas las coincidencias sin distinguir tildes', () => {
    const [line] = groupTextItems([item('Árbol y arbol', 0, 100, 130)]);
    const matches = findInLine(line, 'arbol');
    expect(matches.map((m) => m.start)).toEqual([0, 8]);
    expect(matches[0].x).toBe(0);
    expect(matches[0].width).toBeCloseTo(50);
  });

  it('findInLine no busca textos vacíos', () => {
    const [line] = groupTextItems([item('texto', 0, 100)]);
    expect(findInLine(line, '   ')).toEqual([]);
  });
});
