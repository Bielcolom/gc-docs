import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DocumentActionsService } from '@core/services';
import { DocumentStore } from '@core/state';
import { DialogShellComponent } from '@shared/components';

interface QualityOption {
  readonly dpi: number;
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-export-images-dialog',
  imports: [ReactiveFormsModule, DialogShellComponent],
  templateUrl: './export-images-dialog.component.html',
  styleUrl: '../settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportImagesDialogComponent {
  private readonly actions = inject(DocumentActionsService);
  private readonly dialogRef = inject(DialogRef);
  protected readonly pageCount = inject(DocumentStore).pageCount;

  protected readonly qualities: readonly QualityOption[] = [
    { dpi: 72, title: 'Pantalla', description: 'Ligero, para ver en el móvil o enviar' },
    { dpi: 150, title: 'Normal', description: 'Buen equilibrio entre nitidez y tamaño' },
    { dpi: 300, title: 'Impresión', description: 'Máxima nitidez, archivos grandes' },
  ];

  protected readonly form = inject(NonNullableFormBuilder).group({ dpi: [150] });

  protected async submit(): Promise<void> {
    this.dialogRef.close();
    await this.actions.exportImages(this.form.getRawValue().dpi);
  }
}
