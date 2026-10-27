import type { FormValue } from '@core/models';
import {
  PDFCheckBox,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFTextField,
  type PDFDocument,
  type PDFField,
} from 'pdf-lib';

/**
 * Escribe los valores de formulario en un PDF.
 * @param flatten Convierte los campos en contenido fijo (necesario al copiar páginas a otro PDF).
 * @returns Los campos que no se pudieron rellenar.
 */
export function fillForm(
  doc: PDFDocument,
  values: ReadonlyMap<string, FormValue>,
  flatten: boolean,
): string[] {
  const form = doc.getForm();
  if (!form.getFields().length) return [];
  const failed: string[] = [];
  for (const [name, value] of values) {
    try {
      setFieldValue(form.getField(name), value);
    } catch {
      failed.push(name);
    }
  }
  if (flatten) {
    form.flatten();
    removeDanglingAnnotations(doc);
  }
  return failed;
}

function setFieldValue(field: PDFField, value: FormValue): void {
  if (field instanceof PDFTextField) field.setText(String(value ?? ''));
  else if (field instanceof PDFCheckBox) {
    if (value) field.check();
    else field.uncheck();
  } else if (
    field instanceof PDFRadioGroup ||
    field instanceof PDFDropdown ||
    field instanceof PDFOptionList
  ) {
    if (value) field.select(String(value));
    else field.clear();
  }
}

/** pdf-lib deja en las páginas referencias a los widgets que borra al aplanar; romperían el PDF. */
function removeDanglingAnnotations(doc: PDFDocument): void {
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    const kept = annots
      .asArray()
      .filter((ref) => !(ref instanceof PDFRef) || doc.context.lookup(ref) !== undefined);
    page.node.set(PDFName.of('Annots'), doc.context.obj(kept));
  }
}
