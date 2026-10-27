import { InjectionToken } from '@angular/core';
import { environment } from '@env/environment';
import type { AppEnvironment } from '@env/environment.model';

/** Configuración del entorno inyectable (facilita sustituirla en los tests). */
export const ENVIRONMENT = new InjectionToken<AppEnvironment>('ENVIRONMENT', {
  providedIn: 'root',
  factory: () => environment,
});
