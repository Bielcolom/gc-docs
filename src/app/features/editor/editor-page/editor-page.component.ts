import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { DocumentStore, EditorStore } from '@core/state';
import { isImageFile, isTypingTarget } from '@core/utils';
import { DocumentViewerComponent } from '../components/document-viewer/document-viewer.component';
import { EditorSidebarComponent } from '../components/editor-sidebar/editor-sidebar.component';
import { InspectorComponent } from '../components/inspector/inspector.component';
import { ToolRailComponent } from '../components/tool-rail/tool-rail.component';
import { EditorCommandsService } from '../services/editor-commands.service';
import { EditorShortcutsService } from '../services/editor-shortcuts.service';

const NARROW_SCREEN = '(max-width: 900px)';
const MEDIUM_SCREEN = '(max-width: 1180px)';

/** Pantalla de edición: herramientas, miniaturas, visor y panel de propiedades. */
@Component({
  selector: 'app-editor-page',
  imports: [ToolRailComponent, EditorSidebarComponent, DocumentViewerComponent, InspectorComponent],
  templateUrl: './editor-page.component.html',
  styleUrl: './editor-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'shortcuts.handle($event)',
    '(document:paste)': 'onPaste($event)',
  },
})
export class EditorPageComponent {
  protected readonly editorStore = inject(EditorStore);
  protected readonly shortcuts = inject(EditorShortcutsService);
  private readonly documentStore = inject(DocumentStore);
  private readonly commands = inject(EditorCommandsService);

  constructor() {
    // Una edición de texto es un único paso de deshacer; se cierra al terminar de editar,
    // aunque el cuadro desaparezca sin perder el foco (p. ej. al cambiar de herramienta).
    effect(() => {
      if (!this.editorStore.editingAnnotationId())
        untracked(() => this.documentStore.endTransaction());
    });

    // En pantallas estrechas, los paneles empiezan cerrados
    const breakpoints = inject(BreakpointObserver);
    if (breakpoints.isMatched(NARROW_SCREEN)) this.editorStore.sidebarOpen.set(false);
    if (breakpoints.isMatched(MEDIUM_SCREEN)) this.editorStore.inspectorOpen.set(false);
  }

  /** Pegar una imagen (Ctrl+V) la coloca en la página actual. */
  protected async onPaste(event: ClipboardEvent): Promise<void> {
    if (isTypingTarget(event.target)) return;
    const file = [...(event.clipboardData?.files ?? [])].find(isImageFile);
    if (!file) return;
    event.preventDefault();
    await this.commands.insertImageFile(file);
  }
}
