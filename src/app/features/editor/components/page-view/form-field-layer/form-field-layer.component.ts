import { ChangeDetectionStrategy, Component, inject, input, resource } from '@angular/core';
import type { FormField, FormValue, PageRef } from '@core/models';
import { FormFieldService } from '@core/pdf';
import { DocumentStore } from '@core/state';

const DEFAULT_FONT_SIZE = 10;
const MAX_AUTO_FONT_SIZE = 12;

/** Campos de formulario del PDF como controles HTML, sincronizados con el documento. */
@Component({
  selector: 'app-form-field-layer',
  templateUrl: './form-field-layer.component.html',
  styleUrl: './form-field-layer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormFieldLayerComponent {
  private readonly formFields = inject(FormFieldService);
  private readonly store = inject(DocumentStore);

  readonly page = input.required<PageRef>();
  readonly zoom = input.required<number>();

  /** `resource` carga datos asíncronos a partir de signals y vuelve a cargar si cambian. */
  protected readonly fields = resource({
    params: () => this.page(),
    loader: ({ params }) => this.formFields.getFields(params),
  });

  protected value(field: FormField): FormValue {
    return this.store.formValue(this.page().sourceId, field.name) ?? field.initialValue;
  }

  protected fontSize(field: FormField): number {
    return (
      (field.fontSize || Math.min(field.h * 0.62, MAX_AUTO_FONT_SIZE) || DEFAULT_FONT_SIZE) *
      this.zoom()
    );
  }

  protected setText(field: FormField, event: Event): void {
    this.update(
      field,
      (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value,
    );
  }

  protected setChecked(field: FormField, event: Event): void {
    this.update(field, (event.target as HTMLInputElement).checked);
  }

  protected update(field: FormField, value: FormValue): void {
    this.store.setFormValue(this.page().sourceId, field.name, value);
  }
}
