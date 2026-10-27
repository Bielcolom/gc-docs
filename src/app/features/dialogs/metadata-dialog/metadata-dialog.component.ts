import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DocumentStore } from '@core/state';
import { DialogShellComponent } from '@shared/components';

@Component({
  selector: 'app-metadata-dialog',
  imports: [ReactiveFormsModule, DialogShellComponent],
  templateUrl: './metadata-dialog.component.html',
  styleUrl: '../settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetadataDialogComponent {
  protected readonly store = inject(DocumentStore);
  protected readonly dialogRef = inject(DialogRef);
  protected readonly form = inject(NonNullableFormBuilder).group({ ...this.store.metadata() });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => this.store.updateMetadata(value));
  }
}
