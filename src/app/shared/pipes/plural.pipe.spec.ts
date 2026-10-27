import { PluralPipe } from './plural.pipe';

describe('PluralPipe', () => {
  const pipe = new PluralPipe();

  it('usa el singular solo para 1', () => {
    expect(pipe.transform(1, 'página', 'páginas')).toBe('1 página');
    expect(pipe.transform(0, 'página', 'páginas')).toBe('0 páginas');
    expect(pipe.transform(3, 'página', 'páginas')).toBe('3 páginas');
  });

  it('puede devolver solo la palabra', () => {
    expect(pipe.transform(2, 'archivo', 'archivos', false)).toBe('archivos');
  });
});
