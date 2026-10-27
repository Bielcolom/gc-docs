import { InjectionToken } from '@angular/core';

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
}

/**
 * Preguntas al usuario que necesita la capa `core` sin depender de componentes concretos.
 * La implementación (diálogos de CDK) la aporta la funcionalidad `dialogs` en `app.config.ts`.
 */
export interface UserPrompts {
  confirm(options: ConfirmOptions): Promise<boolean>;
  /** Devuelve la contraseña o `null` si el usuario cancela. */
  password(fileName: string, incorrect: boolean): Promise<string | null>;
}

export const USER_PROMPTS = new InjectionToken<UserPrompts>('USER_PROMPTS');
