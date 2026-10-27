import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ACCEPT_IMAGES,
  DocumentActionsService,
  FilePickerService,
  ThemeService,
} from '@core/services';
import { BrandLogoComponent, IconComponent } from '@shared/components';
import { APP_PATHS } from '@core/constants';

interface Capability {
  readonly title: string;
  readonly description: string;
}

/** Pantalla de inicio: abrir un PDF, empezar en blanco o convertir imágenes. */
@Component({
  selector: 'app-welcome-page',
  imports: [IconComponent, BrandLogoComponent],
  templateUrl: './welcome-page.component.html',
  styleUrl: './welcome-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomePageComponent {
  private readonly actions = inject(DocumentActionsService);
  private readonly picker = inject(FilePickerService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  protected readonly isDraggingOver = signal(false);

  protected readonly capabilities: readonly Capability[] = [
    {
      title: 'Cambia el texto original',
      description: 'Haz clic en una frase del PDF y reescríbela.',
    },
    { title: 'Firma en segundos', description: 'Dibujada, escrita o desde una foto.' },
    { title: 'Rellena formularios', description: 'Los campos del PDF se vuelven editables.' },
    {
      title: 'Une, divide y reordena',
      description: 'Arrastra páginas o documentos enteros en la vista Organizar.',
    },
    { title: 'Resalta y comenta', description: 'Rotulador, formas, sellos y notas.' },
    {
      title: 'Remata el documento',
      description: 'Marca de agua, números de página y propiedades.',
    },
  ];

  protected async open(): Promise<void> {
    if (await this.actions.pickAndOpen()) await this.goToEditor();
  }

  protected async openBlank(): Promise<void> {
    await this.actions.openBlank();
    await this.goToEditor();
  }

  protected async convertImages(): Promise<void> {
    const files = await this.picker.pick(ACCEPT_IMAGES);
    if (await this.actions.openFiles(files)) await this.goToEditor();
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.isDraggingOver.set(true);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDraggingOver.set(false);
    const files = [...(event.dataTransfer?.files ?? [])];
    if (await this.actions.openFiles(files)) await this.goToEditor();
  }

  private goToEditor(): Promise<boolean> {
    return this.router.navigate(APP_PATHS.editor);
  }
}
