import { UndoHistory } from './undo-history';

describe('UndoHistory', () => {
  let clock: number;
  let history: UndoHistory<number>;

  beforeEach(() => {
    clock = 0;
    history = new UndoHistory(0, { limit: 3, coalesceMs: 1000, now: () => clock });
  });

  it('empieza sin pasos para deshacer ni rehacer', () => {
    expect(history.state()).toBe(0);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('deshace y rehace los cambios en orden', () => {
    history.set(1);
    history.set(2);

    expect(history.undo()).toBe(true);
    expect(history.state()).toBe(1);
    expect(history.undo()).toBe(true);
    expect(history.state()).toBe(0);
    expect(history.undo()).toBe(false);

    expect(history.redo()).toBe(true);
    expect(history.state()).toBe(1);
  });

  it('ignora los cambios que no modifican el estado', () => {
    expect(history.set(0)).toBe(false);
    expect(history.canUndo()).toBe(false);
  });

  it('borra lo que se podía rehacer al hacer un cambio nuevo', () => {
    history.set(1);
    history.undo();
    history.set(5);
    expect(history.canRedo()).toBe(false);
  });

  it('agrupa cambios con la misma clave dentro de la ventana de tiempo', () => {
    history.set(1, 'typing');
    clock = 500;
    history.set(2, 'typing');
    clock = 900;
    history.set(3, 'typing');

    history.undo();
    expect(history.state()).toBe(0);
  });

  it('no agrupa cambios con la misma clave si ha pasado demasiado tiempo', () => {
    history.set(1, 'typing');
    clock = 5000;
    history.set(2, 'typing');

    history.undo();
    expect(history.state()).toBe(1);
  });

  it('convierte una transacción en un único paso', () => {
    history.begin();
    history.set(1);
    history.set(2);
    history.set(3);
    history.end();

    expect(history.state()).toBe(3);
    history.undo();
    expect(history.state()).toBe(0);
  });

  it('no crea un paso si la transacción termina sin cambios', () => {
    history.begin();
    history.end();
    expect(history.canUndo()).toBe(false);
  });

  it('respeta el límite de pasos guardados', () => {
    for (let i = 1; i <= 5; i++) history.set(i);
    while (history.undo());
    expect(history.state()).toBe(2);
  });

  it('replace() cambia el estado sin crear un paso', () => {
    history.replace(7);
    expect(history.state()).toBe(7);
    expect(history.canUndo()).toBe(false);
  });

  it('reset() descarta el historial', () => {
    history.set(1);
    history.reset(10);
    expect(history.state()).toBe(10);
    expect(history.canUndo()).toBe(false);
  });
});
