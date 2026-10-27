import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { STAMP_COLORS } from '@core/constants';
import { ColorSwatchesComponent } from '@shared/components';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

@Component({
  selector: 'app-stamp-properties',
  imports: [ColorSwatchesComponent],
  templateUrl: './stamp-properties.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StampPropertiesComponent {
  protected readonly target = inject(InspectorTargetService);
  protected readonly colors = STAMP_COLORS;
  protected readonly label = computed(() => {
    const a = this.target.annotation();
    return a?.type === 'stamp' ? a.label : '';
  });

  protected onLabel(event: Event): void {
    this.target.setStampLabel((event.target as HTMLInputElement).value);
  }
}
