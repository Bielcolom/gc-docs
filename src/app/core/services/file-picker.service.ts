import { DOCUMENT, Injectable, inject } from '@angular/core';

export const ACCEPT_PDF_AND_IMAGES = 'application/pdf,.pdf,image/*';
export const ACCEPT_IMAGES = 'image/*';

/** Abre el selector de archivos del sistema sin necesitar un `<input type="file">` en la plantilla. */
@Injectable({ providedIn: 'root' })
export class FilePickerService {
  private readonly document = inject(DOCUMENT);

  pick(accept: string, multiple = true): Promise<File[]> {
    return new Promise((resolve) => {
      const input = this.document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      input.addEventListener('change', () => resolve([...(input.files ?? [])]));
      input.addEventListener('cancel', () => resolve([]));
      input.click();
    });
  }
}
