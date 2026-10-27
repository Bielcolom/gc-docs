import { computeDropTarget, type ItemBox } from './drop-position.utils';

/** Cuadrícula de 3 columnas de 100 × 100 con 20 px de separación. */
function grid(count: number): ItemBox[] {
  return Array.from({ length: count }, (_, i) => {
    const left = (i % 3) * 120;
    const top = Math.floor(i / 3) * 120;
    return { left, top, right: left + 100, bottom: top + 100 };
  });
}

describe('computeDropTarget', () => {
  it('devuelve null sin elementos', () => {
    expect(computeDropTarget([], { x: 0, y: 0 }, 20)).toBeNull();
  });

  it('inserta antes del elemento cuando el puntero está en su mitad izquierda', () => {
    expect(computeDropTarget(grid(5), { x: 130, y: 50 }, 20)).toEqual({
      index: 1,
      anchor: 1,
      side: 'before',
    });
  });

  it('inserta después del último de la fila si el puntero queda a la derecha', () => {
    expect(computeDropTarget(grid(5), { x: 330, y: 50 }, 20)).toEqual({
      index: 3,
      anchor: 2,
      side: 'after',
    });
  });

  it('acepta el puntero en el hueco entre filas', () => {
    expect(computeDropTarget(grid(6), { x: 10, y: 109 }, 20)?.index).toBe(0);
  });

  it('va al final si el puntero está por debajo de la cuadrícula', () => {
    expect(computeDropTarget(grid(5), { x: 10, y: 900 }, 20)).toEqual({
      index: 5,
      anchor: 4,
      side: 'after',
    });
  });

  it('va al principio si el puntero está por encima', () => {
    expect(computeDropTarget(grid(5), { x: 10, y: -50 }, 20)).toEqual({
      index: 0,
      anchor: 0,
      side: 'before',
    });
  });
});
