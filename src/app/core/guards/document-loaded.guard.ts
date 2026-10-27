import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { DocumentStore } from '@core/state';

/** Las vistas de trabajo solo tienen sentido con un documento abierto; si no, se vuelve al inicio. */
export const documentLoadedGuard: CanActivateFn = () => {
  const store = inject(DocumentStore);
  return store.hasDocument() || inject(Router).createUrlTree(['/']);
};
