import { DOCUMENT, Injectable, inject } from '@angular/core';

/** Descarga de archivos generados en el navegador. */
@Injectable({ providedIn: 'root' })
export class DownloadService {
  private readonly document = inject(DOCUMENT);

  save(data: Blob | Uint8Array, fileName: string, type = 'application/pdf'): void {
    const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  /** Abre el diálogo de impresión del navegador con un PDF. */
  print(bytes: Uint8Array): void {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const frame = this.document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.src = url;
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        this.document.defaultView?.open(url, '_blank');
      }
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    });
    this.document.body.appendChild(frame);
  }
}
