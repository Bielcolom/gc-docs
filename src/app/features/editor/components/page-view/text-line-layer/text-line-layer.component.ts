import { ChangeDetectionStrategy, Component, inject, input, output, resource } from '@angular/core';
import type { PageRef, TextLine } from '@core/models';
import { TextExtractionService } from '@core/pdf';

/** Recuadra las líneas de texto del PDF para poder hacer clic y editarlas. */
@Component({
  selector: 'app-text-line-layer',
  templateUrl: './text-line-layer.component.html',
  styleUrl: './text-line-layer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextLineLayerComponent {
  private readonly extraction = inject(TextExtractionService);

  readonly page = input.required<PageRef>();
  readonly zoom = input.required<number>();
  /** Líneas que ya se han editado (no se muestran). */
  readonly editedKeys = input.required<ReadonlySet<string>>();
  readonly lineSelected = output<TextLine>();

  protected readonly lines = resource({
    params: () => this.page(),
    loader: ({ params }) => this.extraction.getLines(params),
  });

  protected select(line: TextLine, event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.lineSelected.emit(line);
  }
}
