import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PAGE_NUMBER_MARGIN } from '@core/constants';
import { pageNumberLabel } from '@core/utils';
import { DocumentStore } from '@core/state';

/** Vista previa de la marca de agua y la numeración, tal y como saldrán en el PDF. */
@Component({
  selector: 'app-page-decorations',
  templateUrl: './page-decorations.component.html',
  styleUrl: './page-decorations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageDecorationsComponent {
  private readonly store = inject(DocumentStore);

  readonly pageIndex = input.required<number>();
  readonly zoom = input.required<number>();

  protected readonly watermark = this.store.watermark;
  protected readonly numbers = this.store.pageNumbers;
  protected readonly margin = computed(() => PAGE_NUMBER_MARGIN * this.zoom());
  protected readonly pageLabel = computed(() =>
    pageNumberLabel(this.numbers(), this.pageIndex(), this.store.pageCount()),
  );
  protected readonly watermarkTransform = computed(
    () => `translate(-50%, -50%) rotate(${-this.watermark().angle}deg)`,
  );
}
