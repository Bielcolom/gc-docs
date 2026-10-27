import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SourceRegistryService } from '@core/pdf';
import { makePage, makePages, makeRect } from '@testing/fixtures';
import { DocumentStore } from './document.store';

describe('DocumentStore', () => {
  let store: DocumentStore;
  const names: Record<string, string> = { A: 'b.pdf', B: 'a.pdf' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SourceRegistryService,
          useValue: { changes: signal(0), displayName: (id: string) => names[id] ?? id },
        },
      ],
    });
    store = TestBed.inject(DocumentStore);
    store.load(makePages(3), 'contrato');
  });

  it('carga un documento sin cambios pendientes ni historial', () => {
    expect(store.hasDocument()).toBe(true);
    expect(store.pageCount()).toBe(3);
    expect(store.fileName()).toBe('contrato');
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it('marca cambios pendientes y permite deshacerlos', () => {
    store.rotatePages(['p1'], 90);
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.pages()[0].rotation).toBe(90);

    store.undo();
    expect(store.pages()[0].rotation).toBe(0);
    store.redo();
    expect(store.pages()[0].rotation).toBe(90);
  });

  it('agrupa las anotaciones por página', () => {
    store.addAnnotation(makeRect('a1', 'p1'));
    store.addAnnotation(makeRect('a2', 'p2'));
    store.addAnnotation(makeRect('a3', 'p1'));
    expect(
      store
        .annotationsByPage()
        .get('p1')
        ?.map((a) => a.id),
    ).toEqual(['a1', 'a3']);
  });

  it('una transacción se deshace de una vez', () => {
    store.addAnnotation(makeRect('a1'));
    store.beginTransaction();
    for (let x = 0; x < 5; x++) store.updateAnnotation('a1', { x });
    store.endTransaction();

    store.undo();
    expect(store.findAnnotation('a1')?.x).toBe(10);
  });

  it('syncAnnotationSizes no crea pasos de deshacer', () => {
    store.load(makePages(1), 'x');
    store.addAnnotation(makeRect('a1'));
    store.syncAnnotationSizes(new Map([['a1', { w: 300 }]]));
    expect(store.findAnnotation('a1')?.w).toBe(300);
    store.undo();
    expect(store.annotations()).toEqual([]);
  });

  it('ordena los archivos por su nombre visible', () => {
    store.load([makePage('a', { sourceId: 'A' }), makePage('b', { sourceId: 'B' })], 'x');
    store.sortSourcesByName('asc');
    expect(store.pages().map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('guarda los valores de formulario por archivo de origen', () => {
    store.setFormValue('src-a', 'nombre', 'Gabriel');
    expect(store.formValue('src-a', 'nombre')).toBe('Gabriel');
    expect(store.formValue('src-b', 'nombre')).toBeUndefined();
  });

  it('rename quita la extensión .pdf', () => {
    store.rename('  Informe.PDF ');
    expect(store.fileName()).toBe('Informe');
  });

  it('close deja el store vacío', () => {
    store.close();
    expect(store.hasDocument()).toBe(false);
  });
});
