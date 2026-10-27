import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PageRef } from '@core/models';
import { IconComponent, PageThumbnailComponent } from '@shared/components';

/** Tarjeta de una página en la cuadrícula del organizador (solo presentación). */
@Component({
  selector: 'app-page-card',
  imports: [IconComponent, PageThumbnailComponent],
  templateUrl: './page-card.component.html',
  styleUrl: './page-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-selected]': 'selected()',
    '[class.is-moving]': 'moving()',
    '[attr.data-page-id]': 'page().id',
    '[style.view-transition-name]': "animate() ? 'page-' + page().id : null",
  },
})
export class PageCardComponent {
  readonly page = input.required<PageRef>();
  readonly position = input.required<number>();
  readonly selected = input(false);
  readonly moving = input(false);
  readonly thumbnailSize = input(150);
  /** Color y nombre del archivo de origen (solo si hay varios). */
  readonly sourceColor = input<string | null>(null);
  readonly sourceName = input<string | null>(null);
  readonly animate = input(false);

  readonly toggleSelection = output<void>();
  readonly rotate = output<90 | -90>();
  readonly remove = output<void>();
  readonly open = output<void>();
}
