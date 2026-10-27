import { chunkPages, parsePageRanges } from './page-range.utils';

describe('parsePageRanges', () => {
  it('interpreta páginas sueltas y rangos (en base 0)', () => {
    expect(parsePageRanges('1-3, 5', 8)).toEqual([[0, 1, 2], [4]]);
  });

  it('admite rangos abiertos y separadores ";"', () => {
    expect(parsePageRanges('-2; 7-', 8)).toEqual([
      [0, 1],
      [6, 7],
    ]);
  });

  it('admite rangos descendentes', () => {
    expect(parsePageRanges('3-1', 5)).toEqual([[2, 1, 0]]);
  });

  it.each(['', 'abc', '0', '9', '2-20', '-', '1--2'])('rechaza "%s"', (input) => {
    expect(parsePageRanges(input, 8)).toBeNull();
  });
});

describe('chunkPages', () => {
  it('divide en grupos consecutivos', () => {
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it('usa grupos de al menos una página', () => {
    expect(chunkPages(2, 0)).toEqual([[0], [1]]);
  });
});
