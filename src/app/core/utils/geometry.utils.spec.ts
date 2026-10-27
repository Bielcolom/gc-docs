import {
  absolutePoints,
  displaySize,
  normalizePoints,
  rectFromPoints,
  rectsIntersect,
  resizeRect,
  screenToPage,
  snapAngle,
} from './geometry.utils';

describe('geometry.utils', () => {
  it('displaySize intercambia ancho y alto en páginas giradas 90° o 270°', () => {
    expect(displaySize({ width: 600, height: 800, rotation: 0 })).toEqual({ w: 600, h: 800 });
    expect(displaySize({ width: 600, height: 800, rotation: 270 })).toEqual({ w: 800, h: 600 });
  });

  it('screenToPage tiene en cuenta el zoom y la rotación', () => {
    const size = { w: 600, h: 800 };
    const center = { x: 1000, y: 1000 };
    // Sin rotación: el centro de la pantalla es el centro de la página
    expect(screenToPage(center, center, 2, 0, size)).toEqual({ x: 300, y: 400 });
    // Girada 90°: lo que se ve arriba a la derecha es la esquina superior izquierda de la página
    const p = screenToPage({ x: 1000 + 400, y: 1000 - 300 }, center, 1, 90, size);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('rectFromPoints funciona en cualquier dirección y puede forzar un cuadrado', () => {
    expect(rectFromPoints({ x: 10, y: 10 }, { x: 0, y: 4 })).toEqual({ x: 0, y: 4, w: 10, h: 6 });
    expect(rectFromPoints({ x: 0, y: 0 }, { x: 10, y: 4 }, true)).toEqual({
      x: 0,
      y: 0,
      w: 10,
      h: 10,
    });
  });

  it('rectsIntersect', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsIntersect(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsIntersect(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });

  it('snapAngle ajusta a múltiplos de 45°', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 10, y: 1 });
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(Math.hypot(10, 1));
  });

  it('normalizePoints y absolutePoints son inversas', () => {
    const points = [
      { x: 10, y: 20 },
      { x: 30, y: 60 },
      { x: 20, y: 40 },
    ];
    const geometry = normalizePoints(points);
    expect(geometry).toMatchObject({ x: 10, y: 20, w: 20, h: 40 });
    expect(absolutePoints(geometry)).toEqual(points);
  });

  it('normalizePoints da un tamaño mínimo a las líneas rectas', () => {
    expect(
      normalizePoints([
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ]).h,
    ).toBe(1);
  });

  describe('resizeRect', () => {
    const box = { x: 100, y: 100, w: 100, h: 50 };

    it('el tirador sureste cambia el tamaño sin mover el origen', () => {
      expect(resizeRect(box, 'se', { x: 20, y: 10 }, false)).toEqual({
        x: 100,
        y: 100,
        w: 120,
        h: 60,
      });
    });

    it('el tirador noroeste mueve el origen', () => {
      expect(resizeRect(box, 'nw', { x: 10, y: 10 }, false)).toEqual({
        x: 110,
        y: 110,
        w: 90,
        h: 40,
      });
    });

    it('mantiene la proporción en las esquinas si se pide', () => {
      const r = resizeRect(box, 'se', { x: 100, y: 0 }, true);
      expect(r.w / r.h).toBeCloseTo(2);
      expect(r.w).toBe(200);
    });

    it('no baja del tamaño mínimo', () => {
      expect(resizeRect(box, 'e', { x: -500, y: 0 }, false).w).toBe(4);
    });
  });
});
