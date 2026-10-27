/** `true` si el usuario está escribiendo en un campo (y por tanto los atajos no deben actuar). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Comprueba un atajo escrito como texto, p. ej. `"mod+shift+z"`, `"delete"`, `"alt+arrowleft"`.
 * `mod` es Ctrl en Windows/Linux y Cmd en Mac; la tecla `+` se escribe `plus`. Los modificadores no indicados deben estar sueltos.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const last = parts.pop();
  const key = last === 'plus' ? '+' : last;
  const wants = new Set(parts);
  const mod = event.ctrlKey || event.metaKey;
  return (
    event.key.toLowerCase() === key &&
    wants.has('mod') === mod &&
    wants.has('shift') === event.shiftKey &&
    wants.has('alt') === event.altKey
  );
}

export type ShortcutMap = Readonly<Record<string, (event: KeyboardEvent) => void>>;

/** Ejecuta la acción del primer atajo que coincida. Devuelve `true` si se ha gestionado. */
export function handleShortcuts(event: KeyboardEvent, shortcuts: ShortcutMap): boolean {
  for (const [shortcut, action] of Object.entries(shortcuts)) {
    for (const variant of shortcut.split(',')) {
      if (matchesShortcut(event, variant.trim())) {
        event.preventDefault();
        action(event);
        return true;
      }
    }
  }
  return false;
}
