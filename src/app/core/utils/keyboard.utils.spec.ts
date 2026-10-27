import { handleShortcuts, isTypingTarget, matchesShortcut } from './keyboard.utils';

const key = (k: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { key: k, cancelable: true, ...init });

describe('keyboard.utils', () => {
  describe('matchesShortcut', () => {
    it('acepta Ctrl o Cmd como "mod"', () => {
      expect(matchesShortcut(key('z', { ctrlKey: true }), 'mod+z')).toBe(true);
      expect(matchesShortcut(key('z', { metaKey: true }), 'mod+z')).toBe(true);
    });

    it('exige que los modificadores no indicados estén sueltos', () => {
      expect(matchesShortcut(key('z', { ctrlKey: true, shiftKey: true }), 'mod+z')).toBe(false);
      expect(matchesShortcut(key('z'), 'mod+z')).toBe(false);
    });

    it('no distingue mayúsculas en la tecla y entiende "plus"', () => {
      expect(matchesShortcut(key('Z', { ctrlKey: true, shiftKey: true }), 'mod+shift+z')).toBe(
        true,
      );
      expect(matchesShortcut(key('+', { ctrlKey: true }), 'mod+plus')).toBe(true);
      expect(matchesShortcut(key('ArrowLeft', { altKey: true }), 'alt+arrowleft')).toBe(true);
    });
  });

  describe('handleShortcuts', () => {
    it('ejecuta la primera coincidencia, admite variantes y evita la acción del navegador', () => {
      const redo = vi.fn();
      const event = key('y', { ctrlKey: true });

      expect(handleShortcuts(event, { 'mod+shift+z, mod+y': redo })).toBe(true);
      expect(redo).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(true);
    });

    it('devuelve false si ningún atajo coincide', () => {
      const event = key('q');
      expect(handleShortcuts(event, { e: vi.fn() })).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  it('isTypingTarget detecta campos de texto', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
