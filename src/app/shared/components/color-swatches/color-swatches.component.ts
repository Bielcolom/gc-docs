import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** Selector de color: muestras predefinidas, opción "sin color" y un color personalizado. */
@Component({
  selector: 'app-color-swatches',
  imports: [IconComponent],
  templateUrl: './color-swatches.component.html',
  styleUrl: './color-swatches.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorSwatchesComponent {
  readonly colors = input.required<readonly string[]>();
  readonly value = input<string | null>(null);
  readonly allowNone = input(false);
  /** Nombre accesible del grupo, p. ej. "Color del borde". */
  readonly label = input('Color');
  readonly valueChange = output<string | null>();

  protected readonly normalized = computed(() => this.value()?.toLowerCase() ?? null);
  protected readonly isCustom = computed(() => {
    const v = this.normalized();
    return v !== null && !this.colors().includes(v);
  });

  protected onCustomInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
