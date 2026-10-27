import { DEFAULT_TOOL_STYLE } from '@core/constants';
import type { TextLine } from '@core/models';
import { makePage } from '@testing/fixtures';
import {
  createFromDrag,
  createImage,
  createStamp,
  createText,
  createTextEdit,
  isDragTool,
  withDefaultSize,
} from './annotation-factory';

const style = DEFAULT_TOOL_STYLE;

describe('annotation-factory', () => {
  it('isDragTool distingue las herramientas que se dibujan arrastrando', () => {
    expect(isDragTool('rect')).toBe(true);
    expect(isDragTool('ink')).toBe(true);
    expect(isDragTool('text')).toBe(false);
  });

  describe('createFromDrag', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 40, y: 160 };

    it('crea un rectángulo con el estilo de la herramienta', () => {
      const a = createFromDrag('rect', 'a1', 'p1', [start, end], style, false);
      expect(a).toMatchObject({ type: 'rect', x: 40, y: 100, w: 60, h: 60, stroke: style.color });
    });

    it('el corrector es un rectángulo blanco sin borde', () => {
      const a = createFromDrag('whiteout', 'a1', 'p1', [start, end], style, false);
      expect(a).toMatchObject({ type: 'rect', fill: '#ffffff', stroke: null });
    });

    it('con la restricción activada, la línea se ajusta a 45°', () => {
      const a = createFromDrag(
        'line',
        'a1',
        'p1',
        [
          { x: 0, y: 0 },
          { x: 100, y: 3 },
        ],
        style,
        true,
      );
      expect(a.type).toBe('line');
      expect(a.h).toBe(1);
    });

    it('el resaltado usa su propio color y opacidad completa', () => {
      const a = createFromDrag(
        'highlight',
        'a1',
        'p1',
        [start, end],
        { ...style, opacity: 0.3 },
        false,
      );
      expect(a).toMatchObject({ type: 'highlight', color: style.highlightColor, opacity: 1 });
    });
  });

  it('withDefaultSize da un tamaño razonable a un clic sin arrastre', () => {
    const tiny = createFromDrag('rect', 'a1', 'p1', [{ x: 50, y: 50 }], style, false);
    const sized = withDefaultSize(tiny, { x: 50, y: 50 });
    expect(sized.w).toBeGreaterThan(10);
    expect(sized.x + sized.w / 2).toBe(50);
  });

  it('createText no usa blanco como color de letra', () => {
    const text = createText('p1', { x: 0, y: 100 }, { ...style, color: '#FFFFFF' });
    expect(text.color).not.toBe('#FFFFFF');
    expect(text.text).toBe('');
  });

  it('createTextEdit tapa la línea original y escribe en la misma línea base', () => {
    const line: TextLine = {
      key: '3:120',
      text: 'Importe: 100 €',
      x: 50,
      y: 110,
      width: 90,
      height: 12,
      baseline: 120,
      fontSize: 10,
      fontName: 'g1',
      fontRealName: 'Helvetica',
      fontFamily: 'sans-serif',
      segments: [],
    };
    const edit = createTextEdit(
      'p1',
      line,
      { font: 'helvetica', bold: true, italic: false },
      { text: '#222222', background: '#fafafa' },
      8,
    );
    expect(edit).toMatchObject({
      x: 50,
      y: 112,
      size: 10,
      bold: true,
      color: '#222222',
      editOf: '3:120',
    });
    expect(edit.cover?.color).toBe('#fafafa');
    expect(edit.cover!.x).toBeLessThan(line.x);
    expect(edit.cover!.w).toBeGreaterThan(line.width);
  });

  it('createImage reduce las imágenes grandes manteniendo la proporción', () => {
    const page = makePage('p1');
    const image = createImage(page, 'data:', { width: 4000, height: 2000 });
    expect(image.w).toBeLessThan(page.width);
    expect(image.w / image.h).toBeCloseTo(2);
    expect(image.x + image.w / 2).toBeCloseTo(page.width / 2);
  });

  it('createStamp ajusta el ancho al texto', () => {
    const page = makePage('p1');
    const short = createStamp(page, 'OK', '#c00', () => 10);
    const long = createStamp(page, 'CONFIDENCIAL', '#c00', (size) => size * 12);
    expect(long.w).toBeGreaterThan(short.w);
  });
});
