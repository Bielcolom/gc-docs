import { Injectable, inject } from '@angular/core';
import type { FormField, FormFieldKind, FormValue, PageRef } from '@core/models';
import { applyMatrix } from '@core/utils';
import { SourceRegistryService } from './source-registry.service';

interface PdfJsWidget {
  readonly id: string;
  readonly subtype: string;
  readonly fieldName?: string;
  readonly fieldType?: string;
  readonly fieldValue?: unknown;
  readonly hidden?: boolean;
  readonly rect: [number, number, number, number];
  readonly checkBox?: boolean;
  readonly radioButton?: boolean;
  readonly multiLine?: boolean;
  readonly readOnly?: boolean;
  readonly exportValue?: string;
  readonly buttonValue?: string;
  readonly textFontSize?: number;
  readonly options?: { exportValue?: string; displayValue?: string }[];
}

/** Lee los campos de formulario de una página y los pasa al espacio base. */
@Injectable({ providedIn: 'root' })
export class FormFieldService {
  private readonly sources = inject(SourceRegistryService);

  async getFields(page: PageRef): Promise<FormField[]> {
    const pdfPage = await this.sources.getPageFor(page);
    const annotations = (await pdfPage.getAnnotations({ intent: 'display' })) as PdfJsWidget[];
    return annotations.flatMap((a) => {
      const field = this.toField(a, page);
      return field ? [field] : [];
    });
  }

  private toField(a: PdfJsWidget, page: PageRef): FormField | null {
    if (a.subtype !== 'Widget' || !a.fieldName || a.hidden) return null;
    const kind = this.kindOf(a);
    if (!kind) return null;
    const [x1, y1, x2, y2] = a.rect;
    const p1 = applyMatrix(page.viewportTransform, { x: x1, y: y1 });
    const p2 = applyMatrix(page.viewportTransform, { x: x2, y: y2 });
    return {
      id: a.id,
      name: a.fieldName,
      kind,
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      w: Math.abs(p2.x - p1.x),
      h: Math.abs(p2.y - p1.y),
      multiline: !!a.multiLine,
      readOnly: !!a.readOnly,
      initialValue: this.initialValue(kind, a.fieldValue),
      exportValue: String(a.exportValue ?? a.buttonValue ?? 'Yes'),
      options: (a.options ?? []).map((o) => ({
        value: String(o.exportValue ?? o.displayValue ?? ''),
        label: String(o.displayValue ?? o.exportValue ?? ''),
      })),
      fontSize: a.textFontSize ?? 0,
    };
  }

  private kindOf(a: PdfJsWidget): FormFieldKind | null {
    if (a.fieldType === 'Tx') return 'text';
    if (a.fieldType === 'Btn' && a.checkBox) return 'checkbox';
    if (a.fieldType === 'Btn' && a.radioButton) return 'radio';
    if (a.fieldType === 'Ch') return 'select';
    return null;
  }

  private initialValue(kind: FormFieldKind, value: unknown): FormValue {
    if (kind === 'checkbox') return !!value && value !== 'Off';
    if (kind === 'radio') return value && value !== 'Off' ? String(value) : '';
    if (Array.isArray(value)) return String(value[0] ?? '');
    return value == null ? '' : String(value);
  }
}
