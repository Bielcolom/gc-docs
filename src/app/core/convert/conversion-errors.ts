/** El usuario ha cancelado la conversión (p. ej. al pedirle la contraseña). No es un fallo. */
export class ConversionCancelledError extends Error {
  constructor() {
    super('Conversión cancelada');
    this.name = 'ConversionCancelledError';
  }
}

/** `true` si el error se debe a que el usuario ha cancelado, y no hay que avisar de nada. */
export function isConversionCancelled(error: unknown): boolean {
  return (
    error instanceof ConversionCancelledError ||
    (error instanceof DOMException && error.name === 'AbortError')
  );
}
