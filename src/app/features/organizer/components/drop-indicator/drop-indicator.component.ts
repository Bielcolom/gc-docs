import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DropIndicator } from '../../services/grid-drag-drop.service';

/** Línea de rotulador que marca dónde caerán los elementos que se arrastran. */
@Component({
  selector: 'app-drop-indicator',
  template: '',
  styleUrl: './drop-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.left.px]': 'position().left',
    '[style.top.px]': 'position().top',
    '[style.height.px]': 'position().height',
  },
})
export class DropIndicatorComponent {
  readonly position = input.required<DropIndicator>();
}
