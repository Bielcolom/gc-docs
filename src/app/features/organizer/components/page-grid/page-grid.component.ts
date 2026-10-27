import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import type { PageRef } from '@core/models';
import { DocumentActionsService, ViewTransitionService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import { APP_PATHS } from '@core/constants';
import { GridDragDropService } from '../../services/grid-drag-drop.service';
import { MarqueeSelectionService } from '../../services/marquee-selection.service';
import { DragGhostComponent } from '../drag-ghost/drag-ghost.component';
import { DropIndicatorComponent } from '../drop-indicator/drop-indicator.component';
import { PageCardComponent } from '../page-card/page-card.component';

const CARD_SELECTOR = 'app-page-card';
const GRID_GAP = 14;
/** Por encima de este número de páginas no se anima el cambio de orden (rendimiento). */
const MAX_ANIMATED_PAGES = 160;

/**
 * Cuadrícula de páginas del organizador: selección (clic, Ctrl/⇧, recuadro)
 * y arrastrar y soltar de varias páginas a la vez.
 */
@Component({
  selector: 'app-page-grid',
  imports: [PageCardComponent, DragGhostComponent, DropIndicatorComponent],
  providers: [GridDragDropService, MarqueeSelectionService],
  templateUrl: './page-grid.component.html',
  styleUrl: './page-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageGridComponent {
  readonly thumbnailSize = input(150);
  readonly sourceColors = input.required<ReadonlyMap<string, string>>();

  protected readonly documentStore = inject(DocumentStore);
  protected readonly editorStore = inject(EditorStore);
  protected readonly drag = inject(GridDragDropService);
  protected readonly marquee = inject(MarqueeSelectionService);
  private readonly actions = inject(DocumentActionsService);
  private readonly transitions = inject(ViewTransitionService);
  private readonly router = inject(Router);

  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private anchorId: string | null = null;

  protected readonly pages = this.documentStore.pages;
  protected readonly selection = this.editorStore.selectedPageIds;
  protected readonly animate = computed(() => this.pages().length <= MAX_ANIMATED_PAGES);
  protected readonly showSources = computed(() => this.documentStore.sourceGroups().length > 1);
  protected readonly sourceNames = computed(
    () => new Map(this.documentStore.sourceGroups().map((group) => [group.sourceId, group.name])),
  );
  protected readonly movingIds = computed(() => new Set(this.drag.preview()?.ids ?? []));

  // --- Arrastrar ----------------------------------------------------------------------

  protected onCardPointerDown(event: PointerEvent, page: PageRef): void {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest('button:not(.grip)')) return;
    // En pantallas táctiles solo se arrastra desde el asa, para poder desplazarse con el dedo
    if (event.pointerType === 'touch' && !target.closest('.grip')) return;
    event.preventDefault();
    this.drag.track(
      event,
      () => {
        if (!this.selection().has(page.id)) this.select(page, event.ctrlKey || event.metaKey);
        return {
          ids: this.editorStore.orderedSelectedPageIds(),
          preview: page,
          grid: this.grid().nativeElement,
          scroller: this.scroller().nativeElement,
          itemSelector: CARD_SELECTOR,
          gap: GRID_GAP,
          onDrop: (index) =>
            this.transitions.run(
              () => this.documentStore.movePages(this.editorStore.orderedSelectedPageIds(), index),
              this.animate(),
            ),
        };
      },
      (click) => this.onCardClick(click, page),
    );
  }

  // --- Seleccionar ---------------------------------------------------------------------

  private onCardClick(event: PointerEvent, page: PageRef): void {
    if (event.shiftKey && this.anchorId) {
      const pages = this.pages();
      const anchor = pages.findIndex((p) => p.id === this.anchorId);
      const index = pages.findIndex((p) => p.id === page.id);
      const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
      const base = event.ctrlKey || event.metaKey ? [...this.selection()] : [];
      this.editorStore.setSelectedPages([...base, ...pages.slice(from, to + 1).map((p) => p.id)]);
      return;
    }
    this.select(page, event.ctrlKey || event.metaKey);
  }

  private select(page: PageRef, additive: boolean): void {
    this.anchorId = page.id;
    if (additive) this.editorStore.togglePageSelection(page.id);
    else this.editorStore.setSelectedPages([page.id]);
  }

  protected toggle(page: PageRef): void {
    this.anchorId = page.id;
    this.editorStore.togglePageSelection(page.id);
  }

  protected onBackgroundPointerDown(event: PointerEvent): void {
    if (
      event.button !== 0 ||
      event.pointerType === 'touch' ||
      (event.target as HTMLElement).closest(CARD_SELECTOR)
    )
      return;
    event.preventDefault();
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    this.marquee.start(event, {
      grid: this.grid().nativeElement,
      itemSelector: CARD_SELECTOR,
      idAttribute: 'pageId',
      initial: additive ? this.selection() : new Set(),
      onChange: (ids) => this.editorStore.setSelectedPages(ids),
      onClick: () => {
        if (!additive) this.editorStore.clearPageSelection();
      },
    });
  }

  // --- Acciones de una tarjeta ------------------------------------------------------------

  protected rotate(page: PageRef, delta: 90 | -90): void {
    this.actions.rotate(delta, [page.id]);
  }

  protected remove(page: PageRef): void {
    this.transitions.run(() => this.actions.delete([page.id]), this.animate());
  }

  protected open(index: number): void {
    this.editorStore.requestScroll(index);
    void this.router.navigate(APP_PATHS.editor);
  }
}
