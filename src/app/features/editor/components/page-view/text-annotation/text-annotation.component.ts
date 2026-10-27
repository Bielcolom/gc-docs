import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { getFont } from '@core/fonts';
import type { Size, TextAnnotation } from '@core/models';

export interface TextInput {
  readonly text: string;
  readonly size: Size;
}

/** Diferencia mínima (pt) para considerar que el texto ha cambiado de tamaño. */
const SIZE_TOLERANCE = 0.4;

/**
 * Texto añadido o editado. Al editarse se convierte en un campo `contenteditable`.
 * Informa de su tamaño real para que la selección y la exportación coincidan con lo que se ve.
 */
@Component({
  selector: 'app-text-annotation',
  templateUrl: './text-annotation.component.html',
  styleUrl: './text-annotation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'annotation annotation--text',
    '[class.is-editing]': 'editing()',
    '[style.left.px]': 'annotation().x * zoom()',
    '[style.top.px]': 'annotation().y * zoom()',
    '[style.font-family]': 'fontFamily()',
    '[style.font-size.px]': 'annotation().size * zoom()',
    '[style.font-weight]': 'annotation().bold ? 700 : 400',
    '[style.font-style]': "annotation().italic ? 'italic' : 'normal'",
    '[style.text-decoration]': "annotation().underline ? 'underline' : 'none'",
    '[style.color]': 'annotation().color',
    '[style.background]': "annotation().background ?? 'transparent'",
    '[style.text-align]': 'annotation().align',
    '[style.opacity]': 'annotation().opacity',
  },
})
export class TextAnnotationComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly annotation = input.required<TextAnnotation>();
  readonly zoom = input.required<number>();
  readonly editing = input(false);

  // No se llama `textInput`: es también un evento nativo de Chrome y burbujearía hasta aquí.
  readonly contentChange = output<TextInput>();
  readonly editEnd = output<string>();
  /** El tamaño dibujado no coincide con el guardado (cambio de fuente, de tamaño…). */
  readonly sizeChange = output<Size>();

  private readonly editor = viewChild<ElementRef<HTMLDivElement>>('editor');
  protected readonly fontFamily = computed(() => getFont(this.annotation().font).cssFamily);

  constructor() {
    // Al entrar en edición: rellenar el campo, enfocarlo y poner el cursor al final
    effect(() => {
      const editor = this.editor()?.nativeElement;
      if (!editor) return;
      editor.innerText = untracked(() => this.annotation().text);
      editor.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    afterRenderEffect({
      read: () => {
        if (this.editing()) return;
        const { w, h } = this.annotation();
        const measured = this.measure();
        if (
          Math.abs(measured.w - w) > SIZE_TOLERANCE ||
          Math.abs(measured.h - h) > SIZE_TOLERANCE
        ) {
          this.sizeChange.emit(measured);
        }
      },
    });
  }

  protected onInput(): void {
    this.contentChange.emit({ text: this.currentText(), size: this.measure() });
  }

  protected onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      (event.target as HTMLElement).blur();
    }
  }

  protected onBlur(): void {
    this.editEnd.emit(this.currentText());
  }

  private currentText(): string {
    return (this.editor()?.nativeElement.innerText ?? this.annotation().text).replace(/\n$/, '');
  }

  private measure(): Size {
    const el = this.host.nativeElement;
    const zoom = this.zoom();
    return { w: el.offsetWidth / zoom, h: el.offsetHeight / zoom };
  }
}
