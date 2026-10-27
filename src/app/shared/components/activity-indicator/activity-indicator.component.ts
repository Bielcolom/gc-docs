import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivityService } from '@core/services';

/** Píldora "trabajando…" mientras dura una operación larga. */
@Component({
  selector: 'app-activity-indicator',
  templateUrl: './activity-indicator.component.html',
  styleUrl: './activity-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityIndicatorComponent {
  protected readonly activity = inject(ActivityService);
}
