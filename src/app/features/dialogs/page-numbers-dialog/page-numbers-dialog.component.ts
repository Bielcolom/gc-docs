import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { PageNumberPosition } from '@core/models';
import { DocumentStore } from '@core/state';
import { formatPageNumber } from '@core/utils';
import { DialogShellComponent } from '@shared/components';

const FORMATS = ['{n}', '{n} / {total}', 'Página {n}', 'Página {n} de {total}', '— {n} —'] as const;

const POSITIONS: readonly { readonly id: PageNumberPosition; readonly label: string }[] = [
  { id: 'top-left', label: 'Arriba a la izquierda' },
  { id: 'top-center', label: 'Arriba en el centro' },
  { id: 'top-right', label: 'Arriba a la derecha' },
  { id: 'bottom-left', label: 'Abajo a la izquierda' },
  { id: 'bottom-center', label: 'Abajo en el centro' },
  { id: 'bottom-right', label: 'Abajo a la derecha' },
];

@Component({
  selector: 'app-page-numbers-dialog',
  imports: [ReactiveFormsModule, DialogShellComponent],
  templateUrl: './page-numbers-dialog.component.html',
  styleUrls: ['../settings-dialog.scss', './page-numbers-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageNumbersDialogComponent {
  private readonly store = inject(DocumentStore);
  protected readonly dialogRef = inject(DialogRef);

  protected readonly positions = POSITIONS;
  /** Ejemplo de cada formato, p. ej. "Página 3 de 12". */
  protected readonly formats = FORMATS.map((format) => ({
    format,
    example: formatPageNumber(format, 3, 12),
  }));

  protected readonly form = inject(NonNullableFormBuilder).group({
    ...this.store.pageNumbers(),
    startAt: [this.store.pageNumbers().startAt, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      if (this.form.valid) this.store.updatePageNumbers(this.form.getRawValue());
    });
  }
}
