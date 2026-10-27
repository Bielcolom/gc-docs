import {
  makePage,
  makePages,
  makeRect,
  makeState,
  makeText,
  pageIds,
  sequentialIds,
} from '@testing/fixtures';
import {
  addAnnotation,
  deletePages,
  duplicateAnnotation,
  duplicatePages,
  formValueKey,
  groupBySource,
  insertPages,
  moveAnnotationInStack,
  movePages,
  placePages,
  removeAnnotation,
  reorderSources,
  reversePages,
  rotatePages,
  setFormValue,
  shiftPages,
  sortSourcesByName,
  updateAnnotation,
} from './document.operations';

describe('document.operations', () => {
  describe('páginas', () => {
    it('inserta páginas en la posición indicada', () => {
      const state = insertPages(makeState(), [makePage('new')], 1);
      expect(pageIds(state)).toEqual(['p1', 'new', 'p2', 'p3']);
    });

    it('inserta al final por defecto y limita la posición', () => {
      expect(pageIds(insertPages(makeState(), [makePage('x')]))).toEqual(['p1', 'p2', 'p3', 'x']);
      expect(pageIds(insertPages(makeState(), [makePage('x')], -5))[0]).toBe('x');
    });

    it('gira las páginas y normaliza el ángulo', () => {
      const state = rotatePages(makeState(), ['p1'], -90);
      expect(state.pages[0].rotation).toBe(270);
      expect(rotatePages(state, ['p1'], 90).pages[0].rotation).toBe(0);
    });

    it('devuelve el mismo estado si no hay nada que girar', () => {
      const state = makeState();
      expect(rotatePages(state, ['nope'], 90)).toBe(state);
    });

    it('elimina páginas junto con sus anotaciones', () => {
      const state = deletePages(
        makeState({ annotations: [makeRect('a1', 'p1'), makeRect('a2', 'p2')] }),
        ['p1'],
      );
      expect(pageIds(state)).toEqual(['p2', 'p3']);
      expect(state.annotations.map((a) => a.id)).toEqual(['a2']);
    });

    it('nunca deja el documento sin páginas', () => {
      const state = makeState();
      expect(deletePages(state, ['p1', 'p2', 'p3'])).toBe(state);
    });

    it('duplica páginas con sus anotaciones justo después de la original', () => {
      const state = duplicatePages(
        makeState({ annotations: [makeRect('a1', 'p2')] }),
        ['p2'],
        sequentialIds(),
      );
      expect(pageIds(state)).toEqual(['p1', 'p2', 'pg-1', 'p3']);
      expect(state.annotations).toHaveLength(2);
      expect(state.annotations[1]).toMatchObject({ id: 'an-2', pageId: 'pg-1' });
    });

    it('movePages coloca las páginas antes de la que ocupa el índice de destino', () => {
      const state = makeState({ pages: makePages(5) });
      expect(pageIds(movePages(state, ['p4', 'p5'], 1))).toEqual(['p1', 'p4', 'p5', 'p2', 'p3']);
      expect(pageIds(movePages(state, ['p1'], 5))).toEqual(['p2', 'p3', 'p4', 'p5', 'p1']);
    });

    it('placePages deja la primera página movida en la posición final indicada', () => {
      const state = makeState({ pages: makePages(5) });
      expect(pageIds(placePages(state, ['p1', 'p2'], 2))).toEqual(['p3', 'p4', 'p1', 'p2', 'p5']);
    });

    it('mover a la misma posición no crea un estado nuevo', () => {
      const state = makeState();
      expect(placePages(state, ['p2'], 1)).toBe(state);
    });

    it('desplaza páginas no consecutivas una posición', () => {
      const state = makeState({ pages: makePages(5) });
      expect(pageIds(shiftPages(state, ['p2', 'p4'], -1))).toEqual(['p2', 'p1', 'p4', 'p3', 'p5']);
      expect(pageIds(shiftPages(state, ['p2', 'p4'], 1))).toEqual(['p1', 'p3', 'p2', 'p5', 'p4']);
    });

    it('no desplaza si alguna página ya está en el extremo', () => {
      const state = makeState();
      expect(shiftPages(state, ['p1', 'p2'], -1)).toBe(state);
      expect(shiftPages(state, ['p3'], 1)).toBe(state);
    });

    it('invierte el orden', () => {
      expect(pageIds(reversePages(makeState()))).toEqual(['p3', 'p2', 'p1']);
    });
  });

  describe('documentos de origen', () => {
    const mixed = () =>
      makeState({
        pages: [
          makePage('a1', { sourceId: 'A' }),
          makePage('b1', { sourceId: 'B' }),
          makePage('a2', { sourceId: 'A' }),
          makePage('c1', { sourceId: 'C' }),
        ],
      });
    const names: Record<string, string> = { A: 'Zeta.pdf', B: 'alfa.pdf', C: 'Beta 10.pdf' };

    it('agrupa por archivo en el orden en que aparece cada uno', () => {
      const groups = groupBySource(mixed().pages, (id) => names[id]);
      expect(groups.map((g) => [g.sourceId, g.pages.map((p) => p.id)])).toEqual([
        ['A', ['a1', 'a2']],
        ['B', ['b1']],
        ['C', ['c1']],
      ]);
    });

    it('reordena archivos completos manteniendo sus páginas juntas', () => {
      expect(pageIds(reorderSources(mixed(), ['C', 'A', 'B']))).toEqual(['c1', 'a1', 'a2', 'b1']);
    });

    it('añade al final los archivos que no aparecen en el orden indicado', () => {
      expect(pageIds(reorderSources(mixed(), ['B']))).toEqual(['b1', 'a1', 'a2', 'c1']);
    });

    it('ordena por nombre sin distinguir mayúsculas', () => {
      const asc = sortSourcesByName(mixed(), (id) => names[id], 'asc');
      expect(pageIds(asc)).toEqual(['b1', 'c1', 'a1', 'a2']);
      const desc = sortSourcesByName(mixed(), (id) => names[id], 'desc');
      expect(pageIds(desc)).toEqual(['a1', 'a2', 'c1', 'b1']);
    });
  });

  describe('anotaciones', () => {
    it('añade, modifica y elimina anotaciones', () => {
      let state = addAnnotation(makeState(), makeRect('a1'));
      state = updateAnnotation(state, 'a1', { x: 99 });
      expect(state.annotations[0].x).toBe(99);
      state = removeAnnotation(state, 'a1');
      expect(state.annotations).toEqual([]);
    });

    it('devuelve el mismo estado al eliminar una anotación que no existe', () => {
      const state = makeState();
      expect(removeAnnotation(state, 'nope')).toBe(state);
    });

    it('duplica desplazada y convierte una edición de texto en texto normal', () => {
      const edit = {
        ...makeText('t1'),
        cover: { x: 0, y: 0, w: 10, h: 10, color: '#fff' },
        editOf: 'line-1',
      };
      const state = duplicateAnnotation(makeState({ annotations: [edit] }), 't1', 't2', 10);
      const copy = state.annotations[1];
      expect(copy).toMatchObject({ id: 't2', x: 10, y: 10 });
      expect(copy).not.toHaveProperty('cover');
      expect(copy).not.toHaveProperty('editOf');
    });

    it('lleva una anotación delante o detrás del resto', () => {
      const state = makeState({ annotations: [makeRect('a'), makeRect('b'), makeRect('c')] });
      expect(moveAnnotationInStack(state, 'a', 'front').annotations.map((a) => a.id)).toEqual([
        'b',
        'c',
        'a',
      ]);
      expect(moveAnnotationInStack(state, 'c', 'back').annotations.map((a) => a.id)).toEqual([
        'c',
        'a',
        'b',
      ]);
    });
  });

  describe('formularios', () => {
    it('guarda valores por archivo y campo', () => {
      const key = formValueKey('src-a', 'nombre');
      const state = setFormValue(makeState(), key, 'Gabriel');
      expect(state.formValues[key]).toBe('Gabriel');
      expect(setFormValue(state, key, 'Gabriel')).toBe(state);
    });
  });
});
