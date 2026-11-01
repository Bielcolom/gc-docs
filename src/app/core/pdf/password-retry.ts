import type { UserPrompts } from '@core/tokens/user-prompts.token';
import { PasswordRequiredError } from './pdf-errors';

/**
 * Abre un PDF pidiendo la contraseña tantas veces como haga falta.
 * Devuelve `null` si el usuario cancela.
 */
export async function openWithPassword<T>(
  prompts: Pick<UserPrompts, 'password'>,
  fileName: string,
  open: (password?: string) => Promise<T>,
): Promise<T | null> {
  let password: string | undefined;
  for (;;) {
    try {
      return await open(password);
    } catch (error) {
      if (!(error instanceof PasswordRequiredError)) throw error;
      const answer = await prompts.password(fileName, error.incorrect);
      if (answer === null) return null;
      password = answer;
    }
  }
}
