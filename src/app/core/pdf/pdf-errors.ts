/** El PDF está protegido y hace falta (otra) contraseña para abrirlo. */
export class PasswordRequiredError extends Error {
  constructor(readonly incorrect: boolean) {
    super(incorrect ? 'Contraseña incorrecta' : 'Este PDF necesita contraseña');
    this.name = 'PasswordRequiredError';
  }
}

/** pdf.js cancela los renders que se sustituyen por otros más recientes: no son errores. */
export function isRenderCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'RenderingCancelledException';
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
