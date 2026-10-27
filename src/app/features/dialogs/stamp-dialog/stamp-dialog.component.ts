import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { STAMP_COLORS, STAMP_PRESETS, type StampPreset } from '@core/constants';
import { ColorSwatchesComponent, DialogShellComponent } from '@shared/components';

export type StampResult = StampPreset;

const MAX_LABEL_LENGTH = 28;

@Component({
  selector: 'app-stamp-dialog',
  imports: [ReactiveFormsModule, DialogShellComponent, ColorSwatchesComponent],
  templateUrl: './stamp-dialog.component.html',
  styleUrl: './stamp-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StampDialogComponent {
  private readonly dialogRef = inject<DialogRef<StampResult>>(DialogRef);

  protected readonly presets = STAMP_PRESETS;
  protected readonly colors = STAMP_COLORS;
  protected readonly maxLength = MAX_LABEL_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    label: [
      '',
      [Validators.required, Validators.maxLength(MAX_LABEL_LENGTH), Validators.pattern(/\S/)],
    ],
    color: [STAMP_COLORS[0] as string],
  });

  protected choose(stamp: StampPreset): void {
    this.dialogRef.close(stamp);
  }

  protected submitCustom(): void {
    if (this.form.invalid) return;
    const { label, color } = this.form.getRawValue();
    this.dialogRef.close({ label: label.trim().toUpperCase(), color });
  }
}
