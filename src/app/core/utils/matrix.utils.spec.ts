import type { Matrix, Point, Rotation } from '@core/models';
import { applyMatrix, baseFromDisplay, flipY, IDENTITY, invert, multiply } from './matrix.utils';

const expectPoint = (actual: Point, expected: Point): void => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
};

describe('matrix.utils', () => {
  const scaleAndMove: Matrix = [2, 0, 0, 3, 10, 20];

  it('la identidad no cambia los puntos', () => {
    expectPoint(applyMatrix(IDENTITY, { x: 4, y: 5 }), { x: 4, y: 5 });
  });

  it('multiply aplica primero la segunda matriz', () => {
    const translate: Matrix = [1, 0, 0, 1, 5, 0];
    const scale: Matrix = [2, 0, 0, 2, 0, 0];
    // escala y después traslada
    expectPoint(applyMatrix(multiply(translate, scale), { x: 1, y: 1 }), { x: 7, y: 2 });
  });

  it('invert deshace la transformación', () => {
    const p = { x: 7, y: -3 };
    expectPoint(applyMatrix(invert(scaleAndMove), applyMatrix(scaleAndMove, p)), p);
  });

  it('invert rechaza matrices sin inversa', () => {
    expect(() => invert([0, 0, 0, 0, 1, 1])).toThrow();
  });

  it('flipY invierte el eje vertical', () => {
    expectPoint(applyMatrix(flipY(800), { x: 10, y: 0 }), { x: 10, y: 800 });
    expectPoint(applyMatrix(flipY(800), { x: 10, y: 800 }), { x: 10, y: 0 });
  });

  describe('baseFromDisplay', () => {
    // Página base de 600 × 800. Una esquina vista en pantalla y su posición en el espacio base.
    const cases: [Rotation, Point, Point][] = [
      [0, { x: 0, y: 0 }, { x: 0, y: 0 }],
      // Girada 90° a la derecha: la esquina superior izquierda en pantalla es la inferior izquierda de la base
      [90, { x: 0, y: 0 }, { x: 0, y: 800 }],
      [180, { x: 0, y: 0 }, { x: 600, y: 800 }],
      [270, { x: 0, y: 0 }, { x: 600, y: 0 }],
      [90, { x: 800, y: 600 }, { x: 600, y: 0 }],
    ];

    it.each(cases)('rotación %i: %o en pantalla es %o en la base', (rotation, display, base) => {
      expectPoint(applyMatrix(baseFromDisplay(rotation, 600, 800), display), base);
    });
  });
});
