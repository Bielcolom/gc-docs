import { ApplicationRef, DOCUMENT, Injectable, inject } from '@angular/core';

type DocumentWithTransitions = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Anima cambios de la interfaz con la View Transitions API del navegador:
 * los elementos con `view-transition-name` se desplazan suavemente a su nueva posición.
 */
@Injectable({ providedIn: 'root' })
export class ViewTransitionService {
  private readonly document = inject(DOCUMENT) as DocumentWithTransitions;
  private readonly appRef = inject(ApplicationRef);

  run(change: () => void, enabled = true): void {
    const reduceMotion = this.document.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (!enabled || reduceMotion || !this.document.startViewTransition) {
      change();
      return;
    }
    this.document.startViewTransition(() => {
      change();
      // La transición necesita el DOM actualizado en este mismo instante
      this.appRef.tick();
    });
  }
}
