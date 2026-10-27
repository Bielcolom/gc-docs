import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { STORAGE_KEYS } from '@core/constants';
import { SourceRegistryService } from '@core/pdf';
import { DocumentActionsService, StorageService, ViewTransitionService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import { handleShortcuts, isTypingTarget } from '@core/utils';
import { DialogService } from '@features/dialogs/dialog.service';
import { IconComponent } from '@shared/components';
import { APP_PATHS } from '@core/constants';
import { DocumentGridComponent } from '../components/document-grid/document-grid.component';
import { PageGridComponent } from '../components/page-grid/page-grid.component';
import { SelectionToolbarComponent } from '../components/selection-toolbar/selection-toolbar.component';
import {
  SourceLegendComponent,
  type LegendSelection,
} from '../components/source-legend/source-legend.component';
import { sourceColorMap } from '../services/source-colors';

type OrganizerMode = 'pages' | 'documents';

const MIN_THUMBNAIL = 90;
const MAX_THUMBNAIL = 300;

/**
 * Vista "Organizar": todas las páginas en cuadrícula para reordenarlas en bloque,
 * o los documentos de origen para moverlos enteros.
 */
@Component({
  selector: 'app-organizer-page',
  imports: [
    IconComponent,
    PageGridComponent,
    DocumentGridComponent,
    SelectionToolbarComponent,
    SourceLegendComponent,
  ],
  templateUrl: './organizer-page.component.html',
  styleUrl: './organizer-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class OrganizerPageComponent {
  protected readonly documentStore = inject(DocumentStore);
  protected readonly editorStore = inject(EditorStore);
  protected readonly actions = inject(DocumentActionsService);
  private readonly sources = inject(SourceRegistryService);
  private readonly storage = inject(StorageService);
  private readonly transitions = inject(ViewTransitionService);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly minThumbnail = MIN_THUMBNAIL;
  protected readonly maxThumbnail = MAX_THUMBNAIL;
  protected readonly mode = signal<OrganizerMode>('pages');
  protected readonly thumbnailSize = signal(
    this.storage.get(
      STORAGE_KEYS.organizerThumbSize,
      inject(BreakpointObserver).isMatched('(max-width: 700px)') ? 110 : 150,
    ),
  );

  protected readonly groups = this.documentStore.sourceGroups;
  protected readonly sourceColors = computed(() => sourceColorMap(this.sources.ids()));

  protected setThumbnailSize(event: Event): void {
    const size = Number((event.target as HTMLInputElement).value);
    this.thumbnailSize.set(size);
    this.storage.set(STORAGE_KEYS.organizerThumbSize, size);
  }

  protected selectSource({ sourceId, additive }: LegendSelection): void {
    const ids = this.documentStore
      .pages()
      .filter((p) => p.sourceId === sourceId)
      .map((p) => p.id);
    this.editorStore.setSelectedPages(
      additive ? [...this.editorStore.selectedPageIds(), ...ids] : ids,
    );
  }

  protected showSourcePages(sourceId: string): void {
    this.mode.set('pages');
    this.selectSource({ sourceId, additive: false });
  }

  protected sort(direction: 'asc' | 'desc'): void {
    this.transitions.run(() => this.documentStore.sortSourcesByName(direction));
  }

  protected reverse(): void {
    if (this.mode() === 'documents') {
      const order = this.groups()
        .map((g) => g.sourceId)
        .reverse();
      this.transitions.run(() => this.documentStore.reorderSources(order));
    } else {
      this.transitions.run(() => this.documentStore.reversePages());
    }
  }

  protected done(): void {
    void this.router.navigate(APP_PATHS.editor);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.dialogs.hasOpenDialogs() || isTypingTarget(event.target)) return;
    const hasSelection = this.editorStore.selectedPageCount() > 0;
    const ids = () => this.editorStore.orderedSelectedPageIds();
    handleShortcuts(event, {
      'mod+a': () => this.editorStore.setSelectedPages(this.documentStore.pages().map((p) => p.id)),
      escape: () => (hasSelection ? this.editorStore.clearPageSelection() : this.done()),
      ...(hasSelection
        ? {
            'delete, backspace': () => this.transitions.run(() => this.actions.delete(ids())),
            'mod+d': () => this.transitions.run(() => this.actions.duplicate(ids())),
            'alt+arrowleft, alt+arrowup': () =>
              this.transitions.run(() => this.documentStore.shiftPages(ids(), -1)),
            'alt+arrowright, alt+arrowdown': () =>
              this.transitions.run(() => this.documentStore.shiftPages(ids(), 1)),
            r: () => this.actions.rotate(90, ids()),
            'shift+r': () => this.actions.rotate(-90, ids()),
            enter: () => {
              this.editorStore.requestScroll(this.documentStore.pageIndex(ids()[0]));
              this.done();
            },
          }
        : {}),
    });
  }
}
