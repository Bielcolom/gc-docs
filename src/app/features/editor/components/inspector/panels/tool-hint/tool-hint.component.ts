import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, type IconName } from '@shared/components';

const HINTS = {
  'edit-text': {
    icon: 'editText',
    text: 'Los textos del PDF aparecen recuadrados. Haz clic en uno para reescribirlo: se mantienen la posición, el tamaño y el color.',
    detail:
      'Si el texto lleva caracteres que la fuente original no admite, se usa una fuente equivalente incrustada.',
  },
  whiteout: {
    icon: 'whiteout',
    text: 'Arrastra sobre cualquier zona para taparla con blanco, como un corrector. Después puedes escribir encima con «Añadir texto».',
    detail: null,
  },
} as const satisfies Record<string, { icon: IconName; text: string; detail: string | null }>;

/** Explicación de las herramientas que no tienen opciones. */
@Component({
  selector: 'app-tool-hint',
  imports: [IconComponent],
  templateUrl: './tool-hint.component.html',
  styleUrl: './tool-hint.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolHintComponent {
  readonly tool = input.required<keyof typeof HINTS>();
  protected readonly hint = computed(() => HINTS[this.tool()]);
}
