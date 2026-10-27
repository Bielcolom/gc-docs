import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { Icon } from './icon';
import { PageActions } from './page-actions';
import { UiService } from './ui.service';

@Component({
  selector: 'app-welcome',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  private readonly store = inject(DocumentStore);
  protected readonly actions = inject(PageActions);
  protected readonly ui = inject(UiService);
  protected readonly over = signal(false);

  protected readonly notes = [
    { t: 'Cambia el texto original', d: 'Haz clic en una frase del PDF y reescríbela.' },
    { t: 'Firma en segundos', d: 'Dibujada, escrita o desde una foto.' },
    { t: 'Rellena formularios', d: 'Los campos del PDF se vuelven editables.' },
    { t: 'Une, divide y reordena', d: 'Arrastra páginas, gíralas o sácalas a otro PDF.' },
    { t: 'Resalta y comenta', d: 'Rotulador, formas, sellos y notas.' },
    { t: 'Remata el documento', d: 'Marca de agua, números de página y propiedades.' },
  ];

  protected async newBlank(): Promise<void> {
    await this.store.newBlankDocument();
  }

  protected async images(): Promise<void> {
    const files = await this.actions.pickFiles('image/*');
    if (files.length) await this.store.addFiles(files);
  }

  protected onDragOver(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      this.over.set(true);
    }
  }

  protected async onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.over.set(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) return;
    try {
      await this.store.addFiles(files);
    } catch (err: any) {
      this.ui.toast(`No se pudo abrir el archivo: ${err?.message ?? err}`, 'error', 6000);
    }
  }
}
