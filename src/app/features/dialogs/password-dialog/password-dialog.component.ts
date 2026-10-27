import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AutofocusDirective } from '@shared/directives';
import { DialogShellComponent } from '@shared/components';

export interface PasswordDialogData {
  readonly fileName: string;
  readonly incorrect: boolean;
}

@Component({
  selector: 'app-password-dialog',
  imports: [ReactiveFormsModule, DialogShellComponent, AutofocusDirective],
  templateUrl: './password-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordDialogComponent {
  protected readonly data = inject<PasswordDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.getRawValue().password);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
