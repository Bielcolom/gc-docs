import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { DocumentActionsService } from '@core/services';
import { DocumentStore } from '@core/state';
import { handleShortcuts, isTypingTarget } from '@core/utils';
import { DialogService } from '@features/dialogs/dialog.service';
import { APP_PATHS } from '@core/constants';
import { TopBarComponent } from '../top-bar/top-bar.component';

/**
 * Marco de las pantallas de trabajo (editor y organizador): barra superior,
 * atajos globales del documento y aviso al salir con cambios sin descargar.
 */
@Component({
  selector: 'app-workspace-layout',
  imports: [RouterOutlet, TopBarComponent],
  templateUrl: './workspace-layout.component.html',
  styleUrl: './workspace-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class WorkspaceLayoutComponent {
  private readonly store = inject(DocumentStore);
  private readonly actions = inject(DocumentActionsService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  constructor() {
    // Al cerrar el documento se vuelve a la pantalla de inicio
    effect(() => {
      if (!this.store.hasDocument()) void this.router.navigate(APP_PATHS.welcome);
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.dialogs.hasOpenDialogs()) return;
    const handled = handleShortcuts(event, {
      'mod+s': () => void this.actions.download(),
      'mod+o': () => void this.openOther(),
      'mod+p': () => void this.actions.print(),
    });
    if (handled || isTypingTarget(event.target)) return;
    handleShortcuts(event, {
      'mod+z': () => this.store.undo(),
      'mod+shift+z, mod+y': () => this.store.redo(),
      'shift+?': () => this.dialogs.openShortcuts(),
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.hasUnsavedChanges()) event.preventDefault();
  }

  private async openOther(): Promise<void> {
    if (await this.actions.pickAndOpen()) void this.router.navigate(APP_PATHS.editor);
  }
}
