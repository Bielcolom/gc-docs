import { CdkDrag, CdkDragPlaceholder, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { PageRef } from '@core/models';
import { DocumentActionsService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import { IconComponent, PageThumbnailComponent } from '@shared/components';
import { PluralPipe } from '@shared/pipes';
import { APP_PATHS } from '@core/constants';

/**
 * Miniaturas de las páginas en el panel lateral.
 * Reordenar con arrastrar y soltar (Angular CDK), seleccionar con Ctrl/⇧ + clic.
 */
@Component({
  selector: 'app-page-list',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    IconComponent,
    PageThumbnailComponent,
    PluralPipe,
  ],
  templateUrl: './page-list.component.html',
  styleUrl: './page-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageListComponent {
  protected readonly documentStore = inject(DocumentStore);
  protected readonly editorStore = inject(EditorStore);
  protected readonly actions = inject(DocumentActionsService);
  private readonly router = inject(Router);

  private anchorId: string | null = null;

  protected readonly selection = this.editorStore.selectedPageIds;
  protected readonly selectionCount = this.editorStore.selectedPageCount;
  protected readonly editedPageIds = computed(
    () => new Set(this.documentStore.annotations().map((a) => a.pageId)),
  );

  protected onDrop(event: CdkDragDrop<readonly PageRef[], readonly PageRef[], PageRef>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.documentStore.placePages([event.item.data.id], event.currentIndex);
  }

  protected onClick(event: MouseEvent, page: PageRef, index: number): void {
    if (event.shiftKey && this.anchorId) {
      const pages = this.documentStore.pages();
      const anchor = pages.findIndex((p) => p.id === this.anchorId);
      const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
      this.editorStore.setSelectedPages([
        ...this.selection(),
        ...pages.slice(from, to + 1).map((p) => p.id),
      ]);
      return;
    }
    this.anchorId = page.id;
    if (event.ctrlKey || event.metaKey) {
      this.editorStore.togglePageSelection(page.id);
      return;
    }
    this.editorStore.clearPageSelection();
    this.editorStore.requestScroll(index);
  }

  protected toggle(event: Event, page: PageRef): void {
    event.stopPropagation();
    this.anchorId = page.id;
    this.editorStore.togglePageSelection(page.id);
  }

  protected rotate(event: Event, page: PageRef, delta: 90 | -90): void {
    event.stopPropagation();
    this.actions.rotate(delta, [page.id]);
  }

  protected remove(event: Event, page: PageRef): void {
    event.stopPropagation();
    this.actions.delete([page.id]);
  }

  protected openOrganizer(): void {
    void this.router.navigate(APP_PATHS.organizer);
  }
}
