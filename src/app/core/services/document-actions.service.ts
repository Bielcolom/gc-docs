import { Injectable, Injector, inject } from '@angular/core';
import type { PdfToolsService } from '@core/export';
import { errorMessage } from '@core/pdf';
import { DocumentStore, EditorStore } from '@core/state';
import { USER_PROMPTS } from '@core/tokens/user-prompts.token';
import { ActivityService } from './activity.service';
import { DocumentLoaderService } from './document-loader.service';
import { ACCEPT_PDF_AND_IMAGES, FilePickerService } from './file-picker.service';
import { NotificationService } from './notification.service';

type TaskResult<T> = { ok: true; value: T } | { ok: false };

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Acciones de alto nivel que lanza el usuario desde distintos sitios (barra superior,
 * panel lateral, organizador, atajos). Coordinan servicios y muestran avisos.
 */
@Injectable({ providedIn: 'root' })
export class DocumentActionsService {
  private readonly documentStore = inject(DocumentStore);
  private readonly editorStore = inject(EditorStore);
  private readonly loader = inject(DocumentLoaderService);
  private readonly injector = inject(Injector);
  private readonly picker = inject(FilePickerService);
  private readonly notifications = inject(NotificationService);
  private readonly activity = inject(ActivityService);
  private readonly prompts = inject(USER_PROMPTS);

  /** Abre archivos como documento nuevo. Devuelve `true` si se ha abierto algo. */
  async openFiles(files: readonly File[]): Promise<boolean> {
    if (!files.length || !(await this.confirmDiscard())) return false;
    try {
      if (this.documentStore.hasDocument()) this.loader.close();
      return (await this.loader.open(files)) > 0;
    } catch (error) {
      this.notifications.error(`No se pudo abrir el archivo: ${errorMessage(error)}`);
      return false;
    }
  }

  async pickAndOpen(): Promise<boolean> {
    return this.openFiles(await this.picker.pick(ACCEPT_PDF_AND_IMAGES));
  }

  async insertFiles(files: readonly File[], at?: number): Promise<void> {
    if (!files.length) return;
    try {
      const count = await this.loader.insert(files, at);
      if (count) this.notifications.success(plural(count, 'página añadida', 'páginas añadidas'));
    } catch (error) {
      this.notifications.error(`No se pudo añadir el archivo: ${errorMessage(error)}`);
    }
  }

  async pickAndInsert(at?: number): Promise<void> {
    await this.insertFiles(await this.picker.pick(ACCEPT_PDF_AND_IMAGES), at);
  }

  async insertBlankPage(at = this.editorStore.currentPageIndex() + 1): Promise<void> {
    await this.loader.insertBlank(at);
    this.notifications.success('Página en blanco añadida');
  }

  async openBlank(): Promise<void> {
    await this.loader.openBlank();
  }

  async close(): Promise<boolean> {
    if (!(await this.confirmDiscard())) return false;
    this.loader.close();
    return true;
  }

  rotate(delta: 90 | -90, ids = this.editorStore.targetPageIds()): void {
    this.documentStore.rotatePages(ids, delta);
  }

  rotateAll(delta: 90 | -90): void {
    this.documentStore.rotatePages(
      this.documentStore.pages().map((p) => p.id),
      delta,
    );
  }

  duplicate(ids = this.editorStore.targetPageIds()): void {
    this.documentStore.duplicatePages(ids);
  }

  delete(ids = this.editorStore.targetPageIds()): void {
    if (!ids.length) return;
    if (ids.length >= this.documentStore.pageCount()) {
      this.notifications.error('El documento necesita al menos una página');
      return;
    }
    this.documentStore.deletePages(ids);
    this.notifications.info(
      ids.length === 1 ? 'Página eliminada' : `${ids.length} páginas eliminadas`,
    );
  }

  async download(): Promise<void> {
    const result = await this.run('Preparando el PDF…', async () =>
      (await this.tools()).downloadPdf(),
    );
    if (!result.ok) return;
    this.documentStore.markSaved();
    this.notifications.success(
      result.value
        ? 'PDF descargado. Las páginas protegidas se han guardado como imagen.'
        : 'PDF descargado',
    );
  }

  async extract(ids = this.editorStore.targetPageIds()): Promise<void> {
    await this.run('Extrayendo páginas…', async () =>
      (await this.tools()).downloadPdf(ids, '_paginas'),
    );
  }

  async split(groups: readonly (readonly number[])[]): Promise<void> {
    const result = await this.run('Dividiendo el documento…', async () =>
      (await this.tools()).downloadSplit(groups),
    );
    if (result.ok)
      this.notifications.success(`${plural(groups.length, 'archivo', 'archivos')} en un ZIP`);
  }

  async exportImages(dpi: number): Promise<void> {
    const result = await this.run('Generando imágenes…', async () =>
      (await this.tools()).downloadImages(dpi),
    );
    if (result.ok) this.notifications.success('Imágenes descargadas');
  }

  async print(): Promise<void> {
    await this.run('Preparando la impresión…', async () => (await this.tools()).print());
  }

  /**
   * Las herramientas de exportación (pdf-lib, fontkit, JSZip: ~1,4 MB) se cargan la
   * primera vez que se usan. El servicio es `providedIn: 'root'`, así que el inyector
   * raíz lo crea en cuanto su código está disponible.
   */
  private async tools(): Promise<PdfToolsService> {
    const { PdfToolsService } = await import('@core/export/pdf-tools.service');
    return this.injector.get(PdfToolsService);
  }

  private async confirmDiscard(): Promise<boolean> {
    if (!this.documentStore.hasUnsavedChanges()) return true;
    return this.prompts.confirm({
      title: 'Hay cambios sin descargar',
      message: 'Si continúas, se perderán los cambios que no hayas descargado.',
      confirmLabel: 'Descartar cambios',
      danger: true,
    });
  }

  /** Ejecuta una tarea con indicador de actividad y convierte los errores en un aviso. */
  private async run<T>(label: string, task: () => Promise<T>): Promise<TaskResult<T>> {
    try {
      return { ok: true, value: await this.activity.run(label, task) };
    } catch (error) {
      this.notifications.error(`No se pudo completar: ${errorMessage(error)}`);
      return { ok: false };
    }
  }
}
