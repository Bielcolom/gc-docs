import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentActionsService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import { DialogService } from '@features/dialogs/dialog.service';
import { IconComponent, type IconName } from '@shared/components';
import { APP_PATHS } from '@core/constants';

interface PanelAction {
  readonly icon: IconName;
  readonly title: string;
  readonly description?: string;
  readonly run: () => void;
}

/** Acciones sobre el documento cuando no hay nada seleccionado. */
@Component({
  selector: 'app-document-panel',
  imports: [IconComponent, NgTemplateOutlet],
  templateUrl: './document-panel.component.html',
  styleUrl: './document-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPanelComponent {
  protected readonly actions = inject(DocumentActionsService);
  private readonly documentStore = inject(DocumentStore);
  private readonly editorStore = inject(EditorStore);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly pageNumber = computed(() => this.editorStore.currentPageIndex() + 1);

  protected readonly organizeActions: readonly PanelAction[] = [
    {
      icon: 'grid',
      title: 'Organizar páginas',
      description: 'Cuadrícula para reordenar páginas y documentos',
      run: () => void this.router.navigate(APP_PATHS.organizer),
    },
    {
      icon: 'filePlus',
      title: 'Unir PDFs',
      description: 'Añade otros PDFs o imágenes al final',
      run: () => void this.actions.pickAndInsert(),
    },
    {
      icon: 'split',
      title: 'Dividir',
      description: 'Por rangos o cada cierto número de páginas',
      run: () => void this.dialogs.openSplit(),
    },
    {
      icon: 'extract',
      title: 'Extraer páginas',
      description: 'Descarga la página actual o las seleccionadas',
      run: () => void this.actions.extract(),
    },
    {
      icon: 'rotateCw',
      title: 'Girar todas',
      description: '90° en el sentido del reloj',
      run: () => this.actions.rotateAll(90),
    },
    {
      icon: 'reverse',
      title: 'Invertir orden',
      description: 'La última página pasa a ser la primera',
      run: () => this.documentStore.reversePages(),
    },
  ];

  protected readonly finishActions = computed<readonly PanelAction[]>(() => {
    const watermark = this.documentStore.watermark();
    const numbers = this.documentStore.pageNumbers();
    return [
      {
        icon: 'watermark',
        title: 'Marca de agua',
        description: watermark.enabled
          ? `Activada: «${watermark.text}»`
          : 'Texto en diagonal en todas las páginas',
        run: () => void this.dialogs.openWatermark(),
      },
      {
        icon: 'hash',
        title: 'Numerar páginas',
        description: numbers.enabled ? 'Activada' : 'Añade el número a pie de página',
        run: () => void this.dialogs.openPageNumbers(),
      },
      {
        icon: 'info',
        title: 'Propiedades',
        description: 'Título, autor y palabras clave',
        run: () => void this.dialogs.openMetadata(),
      },
    ];
  });

  protected readonly exportActions: readonly PanelAction[] = [
    {
      icon: 'download',
      title: 'Descargar PDF',
      description: 'Con todos los cambios aplicados',
      run: () => void this.actions.download(),
    },
    {
      icon: 'image',
      title: 'Guardar como imágenes',
      description: 'Un PNG por página',
      run: () => void this.dialogs.openExportImages(),
    },
    { icon: 'printer', title: 'Imprimir', run: () => void this.actions.print() },
  ];
}
