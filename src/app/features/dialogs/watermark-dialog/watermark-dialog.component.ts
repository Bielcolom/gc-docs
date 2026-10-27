import { DialogRef } from '@angular/cdk/dialog';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PALETTE } from '@core/constants';
import { DocumentStore } from '@core/state';
import { ColorSwatchesComponent, DialogShellComponent } from '@shared/components';

/** La marca de agua se aplica en vivo: cada cambio del formulario actualiza el documento. */
@Component({
  selector: 'app-watermark-dialog',
  imports: [ReactiveFormsModule, DecimalPipe, DialogShellComponent, ColorSwatchesComponent],
  templateUrl: './watermark-dialog.component.html',
  styleUrl: '../settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatermarkDialogComponent {
  private readonly store = inject(DocumentStore);
  protected readonly dialogRef = inject(DialogRef);
  protected readonly colors = PALETTE.slice(0, 10);

  protected readonly form = inject(NonNullableFormBuilder).group({ ...this.store.watermark() });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => this.store.updateWatermark(value));
  }
}
