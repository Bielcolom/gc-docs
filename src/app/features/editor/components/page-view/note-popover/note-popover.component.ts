import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { NoteAnnotation } from '@core/models';
import { AutofocusDirective } from '@shared/directives';

/** Ventana para escribir el texto de un comentario, junto a su icono. */
@Component({
  selector: 'app-note-popover',
  imports: [AutofocusDirective],
  templateUrl: './note-popover.component.html',
  styleUrl: './note-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.left.px]': 'position().left',
    '[style.top.px]': 'position().top',
    '(pointerdown)': '$event.stopPropagation()',
  },
})
export class NotePopoverComponent {
  readonly note = input.required<NoteAnnotation>();
  readonly zoom = input.required<number>();

  readonly textChange = output<string>();
  readonly closeRequest = output<void>();
  readonly removeRequest = output<void>();

  private readonly gap = 6;
  protected readonly position = computed(() => {
    const n = this.note();
    return { left: (n.x + n.w + this.gap) * this.zoom(), top: n.y * this.zoom() };
  });

  protected onInput(event: Event): void {
    this.textChange.emit((event.target as HTMLTextAreaElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      // Se suelta el foco ya: el popover desaparece en el siguiente ciclo de detección de cambios
      (event.target as HTMLElement).blur();
      this.closeRequest.emit();
    }
  }
}
