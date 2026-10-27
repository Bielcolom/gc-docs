import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  type ValidatorFn,
  Validators,
} from '@angular/forms';
import { DocumentActionsService } from '@core/services';
import { DocumentStore } from '@core/state';
import { chunkPages, parsePageRanges } from '@core/utils';
import { DialogShellComponent } from '@shared/components';
import { PluralPipe } from '@shared/pipes';

type SplitMode = 'every' | 'ranges' | 'single';

/** Validador: el texto tiene que ser una lista de rangos válida para el documento. */
function pageRangesValidator(total: () => number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    parsePageRanges(control.value, total()) ? null : { pageRanges: true };
}

@Component({
  selector: 'app-split-dialog',
  imports: [ReactiveFormsModule, DialogShellComponent, PluralPipe],
  templateUrl: './split-dialog.component.html',
  styleUrl: '../settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitDialogComponent {
  private readonly store = inject(DocumentStore);
  private readonly actions = inject(DocumentActionsService);
  private readonly dialogRef = inject(DialogRef);

  protected readonly total = this.store.pageCount;

  protected readonly form = inject(NonNullableFormBuilder).group({
    mode: ['every' as SplitMode],
    every: [1, [Validators.required, Validators.min(1)]],
    ranges: [this.defaultRanges(), pageRangesValidator(() => this.total())],
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Grupos de páginas (base 0) que se generarían, o `null` si los datos no son válidos. */
  protected readonly groups = computed(() => {
    const { mode, every, ranges } = { ...this.form.getRawValue(), ...this.value() };
    const total = this.total();
    if (mode === 'single') return chunkPages(total, 1);
    if (mode === 'every') return every && every >= 1 ? chunkPages(total, every) : null;
    return parsePageRanges(ranges ?? '', total);
  });

  protected async submit(): Promise<void> {
    const groups = this.groups();
    if (!groups?.length) return;
    this.dialogRef.close();
    await this.actions.split(groups);
  }

  private defaultRanges(): string {
    const n = this.store.pageCount();
    const half = Math.ceil(n / 2);
    return n > 1 ? `1-${half}, ${half + 1}-${n}` : '1';
  }
}
