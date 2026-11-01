import { readingOrder, type LayoutBox } from './reading-order';

interface Box extends LayoutBox {
  readonly id: string;
}

const SIZE = 10;

/** Una línea de texto de 10 pt cuya caja empieza en `top`. */
const line = (id: string, x: number, top: number, w = 200): Box => ({
  id,
  x,
  y: top,
  w,
  h: SIZE,
  baseline: top + SIZE * 0.8,
  fontSize: SIZE,
});

const ids = (boxes: readonly Box[]) => readingOrder(boxes).map((o) => o.box.id);

describe('readingOrder', () => {
  it('lee una sola columna de arriba abajo', () => {
    expect(ids([line('c', 50, 124), line('a', 50, 100), line('b', 50, 112)])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('lee un documento a dos columnas columna a columna', () => {
    // Renglones desalineados: cada columna fluye por su cuenta
    const left = [0, 1, 2, 3].map((i) => line(`L${i}`, 50, 100 + i * 12));
    const right = [0, 1, 2, 3].map((i) => line(`R${i}`, 300, 105 + i * 12));
    expect(ids([...right, ...left])).toEqual(['L0', 'L1', 'L2', 'L3', 'R0', 'R1', 'R2', 'R3']);
  });

  it('respeta un título a todo lo ancho sobre las dos columnas', () => {
    const title = line('T', 50, 60, 450);
    const left = [0, 1, 2].map((i) => line(`L${i}`, 50, 100 + i * 12));
    const right = [0, 1, 2].map((i) => line(`R${i}`, 300, 105 + i * 12));
    const order = readingOrder([...right, title, ...left]);
    expect(order.map((o) => o.box.id)).toEqual(['T', 'L0', 'L1', 'L2', 'R0', 'R1', 'R2']);
    expect(order[0].column.nested).toBe(false);
    expect(order[1].column).toEqual({ left: 50, right: 250, nested: true });
  });

  it('lee una tabla fila a fila', () => {
    // Celdas cortas con los renglones alineados: no son columnas de texto
    const rows = [0, 1, 2].flatMap((i) => [
      line(`n${i}`, 50, 100 + i * 20, 60),
      line(`v${i}`, 300, 100 + i * 20, 60),
    ]);
    expect(ids(rows)).toEqual(['n0', 'v0', 'n1', 'v1', 'n2', 'v2']);
  });

  it('separa columnas de texto aunque sus renglones coincidan', () => {
    const left = [0, 1, 2, 3].map((i) => line(`L${i}`, 50, 100 + i * 12, 220));
    const right = [0, 1, 2, 3].map((i) => line(`R${i}`, 300, 100 + i * 12, 220));
    expect(ids([...left, ...right])).toEqual(['L0', 'L1', 'L2', 'L3', 'R0', 'R1', 'R2', 'R3']);
  });

  it('devuelve una lista vacía si no hay nada', () => {
    expect(readingOrder([])).toEqual([]);
  });
});
