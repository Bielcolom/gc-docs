import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FILE_FORMATS, FORMAT_IDS, findConverter, isFormatId } from '@core/convert';
import type { ConversionPair, FileFormatId } from '@core/models';
import { IconComponent } from '@shared/components';

interface FormatOption {
  readonly id: FileFormatId;
  readonly label: string;
}

/**
 * Elige el sentido de la conversión: formato de origen, formato de destino y un botón para
 * invertirlo. Muestra todos los formatos en los dos lados; los pares sin conversor salen como
 * "próximamente" para que se vea que el sentido contrario existe aunque aún no esté listo.
 */
@Component({
  selector: 'app-format-switch',
  imports: [IconComponent],
  templateUrl: './format-switch.component.html',
  styleUrl: './format-switch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormatSwitchComponent {
  readonly from = input.required<FileFormatId>();
  readonly to = input.required<FileFormatId>();
  readonly disabled = input(false);

  /** Nuevo sentido elegido. Si se elige el mismo formato en los dos lados, se invierte. */
  readonly pairChange = output<ConversionPair>();

  protected readonly formats = FILE_FORMATS;
  /** Cada clic en invertir gira el icono media vuelta más. */
  protected readonly turns = signal(0);

  // La opción elegida y la del otro lado (que invierte el sentido) no llevan la marca
  protected readonly fromOptions = computed(() =>
    this.options((id) => !!findConverter(id, this.to()) || id === this.to() || id === this.from()),
  );
  protected readonly toOptions = computed(() =>
    this.options(
      (id) => !!findConverter(this.from(), id) || id === this.from() || id === this.to(),
    ),
  );
  protected readonly swapLabel = computed(
    () => `Invertir: de ${FILE_FORMATS[this.to()].label} a ${FILE_FORMATS[this.from()].label}`,
  );

  protected swap(): void {
    this.turns.update((t) => t + 1);
    this.pairChange.emit({ from: this.to(), to: this.from() });
  }

  protected pickFrom(event: Event): void {
    const from = (event.target as HTMLSelectElement).value;
    if (!isFormatId(from)) return;
    this.pairChange.emit(from === this.to() ? { from, to: this.from() } : { from, to: this.to() });
  }

  protected pickTo(event: Event): void {
    const to = (event.target as HTMLSelectElement).value;
    if (!isFormatId(to)) return;
    this.pairChange.emit(to === this.from() ? { from: this.to(), to } : { from: this.from(), to });
  }

  private options(isAvailable: (id: FileFormatId) => boolean): FormatOption[] {
    return FORMAT_IDS.map((id) => ({
      id,
      label: isAvailable(id) ? FILE_FORMATS[id].label : `${FILE_FORMATS[id].label} · próximamente`,
    }));
  }
}
