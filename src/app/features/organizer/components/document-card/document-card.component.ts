import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { DocumentGroup } from '@core/models';
import { IconComponent, PageThumbnailComponent } from '@shared/components';
import { PluralPipe } from '@shared/pipes';

/** Tarjeta de un archivo de origen: su primera página como portada y sus acciones. */
@Component({
  selector: 'app-document-card',
  imports: [IconComponent, PageThumbnailComponent, PluralPipe],
  templateUrl: './document-card.component.html',
  styleUrl: './document-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-moving]': 'moving()',
    '[attr.data-source-id]': 'group().sourceId',
    '[style.view-transition-name]': "animate() ? 'document-' + group().sourceId : null",
  },
})
export class DocumentCardComponent {
  readonly group = input.required<DocumentGroup>();
  readonly position = input.required<number>();
  readonly total = input.required<number>();
  readonly color = input.required<string>();
  readonly moving = input(false);
  readonly animate = input(false);

  readonly moveBy = output<-1 | 1>();
  readonly showPages = output<void>();
  readonly rotate = output<void>();
  readonly remove = output<void>();
}
