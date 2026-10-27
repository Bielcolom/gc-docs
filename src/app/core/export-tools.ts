import JSZip from 'jszip';
import { DocumentStore } from './document.store';
import { exportPdf } from './exporter';
import { openPdf } from './pdfjs';
import { downloadBlob } from './util';

export async function downloadPdf(store: DocumentStore, pageIds?: string[], suffix = ''): Promise<boolean> {
  const { bytes, rasterized } = await exportPdf(store, { pageIds });
  downloadBlob(bytes, `${store.fileName() || 'documento'}${suffix}.pdf`);
  return rasterized;
}

/** Divide el documento en grupos (índices de página) y descarga un ZIP con un PDF por grupo. */
export async function splitToZip(store: DocumentStore, groups: number[][]): Promise<void> {
  const pages = store.state().pages;
  const zip = new JSZip();
  const name = store.fileName() || 'documento';
  for (let g = 0; g < groups.length; g++) {
    const ids = groups[g].map((i) => pages[i].id);
    const { bytes } = await exportPdf(store, { pageIds: ids });
    const first = groups[g][0] + 1;
    const last = groups[g][groups[g].length - 1] + 1;
    const label = first === last ? `p${first}` : `p${first}-${last}`;
    zip.file(`${name}_${String(g + 1).padStart(2, '0')}_${label}.pdf`, bytes);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${name}_dividido.zip`, 'application/zip');
}

/** Exporta las páginas como imágenes PNG (con todas las ediciones aplicadas). */
export async function exportImages(store: DocumentStore, dpi = 150, pageIds?: string[]): Promise<void> {
  const { bytes } = await exportPdf(store, { pageIds });
  const pdf = await openPdf(bytes);
  const name = store.fileName() || 'documento';
  const zip = new JSZip();
  const scale = dpi / 72;
  let single: Blob | null = null;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({ canvas, viewport: vp, background: '#ffffff' }).promise;
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/png'));
    if (pdf.numPages === 1) single = blob;
    zip.file(`${name}_${String(i).padStart(3, '0')}.png`, blob);
  }
  await pdf.loadingTask.destroy();
  if (single) downloadBlob(single, `${name}.png`, 'image/png');
  else downloadBlob(await zip.generateAsync({ type: 'blob' }), `${name}_imagenes.zip`, 'application/zip');
}

export async function printPdf(store: DocumentStore): Promise<void> {
  const { bytes } = await exportPdf(store);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.src = url;
  document.body.appendChild(frame);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
}
