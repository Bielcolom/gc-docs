import { Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/** Enfoca el elemento al crearse (el atributo `autofocus` nativo no funciona en contenido dinámico). */
@Directive({
  selector: '[appAutofocus]',
})
export class AutofocusDirective {
  /** Seleccionar también el texto de un campo. */
  readonly appAutofocusSelect = input(false);

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      element.focus({ preventScroll: true });
      if (this.appAutofocusSelect() && element instanceof HTMLInputElement) element.select();
    });
  }
}
