import { THUMBNAIL_PRELOAD_MARGIN } from '@core/constants';
import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Indica si el elemento está (o está a punto de estar) visible en pantalla.
 * Sirve para cargar contenido pesado solo cuando hace falta (lazy rendering).
 *
 * @example
 * <div appInViewport [appInViewportMargin]="'300px 0px'" (appInViewport)="onVisible($event)"></div>
 */
@Directive({
  selector: '[appInViewport]',
  exportAs: 'appInViewport',
})
export class InViewportDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Margen alrededor de la pantalla (sintaxis de `rootMargin`): se carga un poco antes de verse. */
  readonly appInViewportMargin = input(THUMBNAIL_PRELOAD_MARGIN);
  readonly appInViewport = output<boolean>();

  private readonly visible = signal(false);
  readonly isVisible = this.visible.asReadonly();

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          const isVisible = entries.some((e) => e.isIntersecting);
          if (isVisible === this.visible()) return;
          this.visible.set(isVisible);
          this.appInViewport.emit(isVisible);
        },
        { rootMargin: this.appInViewportMargin() },
      );
      observer.observe(this.element.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
