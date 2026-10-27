import { Injectable, inject } from '@angular/core';
import type { ConfirmOptions, UserPrompts } from '@core/tokens';
import { DialogService } from './dialog.service';

/** Implementación de `USER_PROMPTS` con los diálogos de la aplicación. */
@Injectable({ providedIn: 'root' })
export class UserPromptsService implements UserPrompts {
  private readonly dialogs = inject(DialogService);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return this.dialogs.confirm(options);
  }

  password(fileName: string, incorrect: boolean): Promise<string | null> {
    return this.dialogs.password(fileName, incorrect);
  }
}
