import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageThumbnailComponent } from '@shared/components';
import type { DragPreview } from '../../services/grid-drag-drop.service';

/** Miniatura que sigue al cursor mientras se arrastran páginas o documentos. */
@Component({
  selector: 'app-drag-ghost',
  imports: [PageThumbnailComponent],
  templateUrl: './drag-ghost.component.html',
  styleUrl: './drag-ghost.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.left.px]': 'preview().x',
    '[style.top.px]': 'preview().y',
  },
})
export class DragGhostComponent {
  readonly preview = input.required<DragPreview>();
}
