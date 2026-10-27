import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PALETTE } from '@core/constants';
import { ColorSwatchesComponent } from '@shared/components';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

@Component({
  selector: 'app-shape-properties',
  imports: [ColorSwatchesComponent],
  templateUrl: './shape-properties.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShapePropertiesComponent {
  protected readonly target = inject(InspectorTargetService);
  protected readonly palette = PALETTE;
  protected readonly hasAnnotation = computed(() => this.target.annotation() !== null);

  protected onWidth(event: Event): void {
    this.target.setStrokeWidth(parseFloat((event.target as HTMLInputElement).value));
  }
}
