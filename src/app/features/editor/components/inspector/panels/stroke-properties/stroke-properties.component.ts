import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PALETTE } from '@core/constants';
import { ColorSwatchesComponent } from '@shared/components';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

/** Líneas, flechas y trazos a mano. */
@Component({
  selector: 'app-stroke-properties',
  imports: [ColorSwatchesComponent],
  templateUrl: './stroke-properties.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrokePropertiesComponent {
  protected readonly target = inject(InspectorTargetService);
  protected readonly palette = PALETTE;

  protected onWidth(event: Event): void {
    this.target.setStrokeWidth(parseFloat((event.target as HTMLInputElement).value));
  }
}
