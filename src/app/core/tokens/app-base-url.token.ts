import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/**
 * URL base de la aplicación con barra final (p. ej. `https://usuario.github.io/gc-docs/`).
 * Se usa para cargar recursos estáticos (worker de pdf.js, fuentes) tanto en local como en GitHub Pages.
 */
export const APP_BASE_URL = new InjectionToken<string>('APP_BASE_URL', {
  providedIn: 'root',
  factory: () => {
    const doc = inject(DOCUMENT);
    return new URL(doc.baseURI || '/', doc.location?.href).href.replace(/\/?$/, '/');
  },
});
