import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentActionsService, NotificationService, ViewTransitionService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import { IconComponent } from '@shared/components';
import { PluralPipe } from '@shared/pipes';

/** Acciones sobre las páginas seleccionadas en el organizador. */
@Component({
  selector: 'app-selection-toolbar',
  imports: [ReactiveFormsModule, IconComponent, PluralPipe],
  templateUrl: './selection-toolbar.component.html',
  styleUrl: './selection-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'toolbar', 'aria-label': 'Acciones con la selección' },
})
export class SelectionToolbarComponent {
  private readonly documentStore = inject(DocumentStore);
  protected readonly editorStore = inject(EditorStore);
  protected readonly actions = inject(DocumentActionsService);
  private readonly transitions = inject(ViewTransitionService);
  private readonly notifications = inject(NotificationService);

  protected readonly count = this.editorStore.selectedPageCount;
  /** Última posición a la que se puede mover la selección. */
  protected readonly maxPosition = computed(
    () => this.documentStore.pageCount() - this.count() + 1,
  );

  protected readonly moveForm = inject(NonNullableFormBuilder).group({
    position: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  private ids(): string[] {
    return this.editorStore.orderedSelectedPageIds();
  }

  protected shift(direction: -1 | 1): void {
    this.transitions.run(() => this.documentStore.shiftPages(this.ids(), direction));
  }

  protected toStart(): void {
    this.transitions.run(() => this.documentStore.placePages(this.ids(), 0));
  }

  protected toEnd(): void {
    this.transitions.run(() =>
      this.documentStore.placePages(this.ids(), this.documentStore.pageCount()),
    );
  }

  protected moveToPosition(): void {
    const position = this.moveForm.getRawValue().position;
    if (this.moveForm.invalid || position === null) return;
    const target = Math.min(position, this.maxPosition());
    const ids = this.ids();
    this.transitions.run(() => this.documentStore.placePages(ids, target - 1));
    this.moveForm.reset();
    this.notifications.success(
      ids.length === 1
        ? `Página movida a la posición ${target}`
        : `${ids.length} páginas movidas a partir de la posición ${target}`,
    );
  }

  protected duplicate(): void {
    this.transitions.run(() => this.actions.duplicate(this.ids()));
  }

  protected remove(): void {
    this.transitions.run(() => this.actions.delete(this.ids()));
  }

  protected selectAll(): void {
    this.editorStore.setSelectedPages(this.documentStore.pages().map((p) => p.id));
  }
}
