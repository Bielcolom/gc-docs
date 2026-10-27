import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { WebFontsService } from '@core/fonts';
import { ThemeService } from '@core/services';
import { USER_PROMPTS } from '@core/tokens';
import { UserPromptsService } from '@features/dialogs/user-prompts.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch()),
    // La capa `core` pide confirmaciones a través de este contrato; los diálogos lo implementan.
    { provide: USER_PROMPTS, useExisting: UserPromptsService },
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(WebFontsService).register();
    }),
  ],
};
