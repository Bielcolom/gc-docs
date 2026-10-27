import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { DocumentGroup } from '@core/models';

export interface LegendSelection {
  readonly sourceId: string;
  /** Añadir a la selección actual en vez de sustituirla. */
  readonly additive: boolean;
}

/** Leyenda de colores de los archivos de origen; un clic selecciona sus páginas. */
@Component({
  selector: 'app-source-legend',
  templateUrl: './source-legend.component.html',
  styleUrl: './source-legend.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceLegendComponent {
  readonly groups = input.required<readonly DocumentGroup[]>();
  readonly colors = input.required<ReadonlyMap<string, string>>();
  readonly selectSource = output<LegendSelection>();

  protected onClick(event: MouseEvent, sourceId: string): void {
    this.selectSource.emit({ sourceId, additive: event.ctrlKey || event.metaKey });
  }
}
