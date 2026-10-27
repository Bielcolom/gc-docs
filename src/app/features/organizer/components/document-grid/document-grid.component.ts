import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { DocumentGroup } from '@core/models';
import { DocumentActionsService, ViewTransitionService } from '@core/services';
import { DocumentStore } from '@core/state';
import { GridDragDropService } from '../../services/grid-drag-drop.service';
import { DocumentCardComponent } from '../document-card/document-card.component';
import { DragGhostComponent } from '../drag-ghost/drag-ghost.component';
import { DropIndicatorComponent } from '../drop-indicator/drop-indicator.component';

const CARD_SELECTOR = 'app-document-card';
const GRID_GAP = 14;

/** Cuadrícula de documentos: reordenar PDFs completos con todas sus páginas. */
@Component({
  selector: 'app-document-grid',
  imports: [DocumentCardComponent, DragGhostComponent, DropIndicatorComponent],
  providers: [GridDragDropService],
  templateUrl: './document-grid.component.html',
  styleUrl: './document-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentGridComponent {
  readonly sourceColors = input.required<ReadonlyMap<string, string>>();
  /** Pide mostrar en la cuadrícula de páginas las de este documento. */
  readonly showPages = output<string>();

  private readonly documentStore = inject(DocumentStore);
  private readonly actions = inject(DocumentActionsService);
  private readonly transitions = inject(ViewTransitionService);
  protected readonly drag = inject(GridDragDropService);

  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  protected readonly groups = this.documentStore.sourceGroups;
  protected readonly movingId = computed(() => this.drag.preview()?.ids[0] ?? null);

  protected onCardPointerDown(event: PointerEvent, group: DocumentGroup): void {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest('button:not(.grip)')) return;
    if (event.pointerType === 'touch' && !target.closest('.grip')) return;
    event.preventDefault();
    this.drag.track(event, () => ({
      ids: [group.sourceId],
      preview: group.pages[0],
      label: group.name,
      grid: this.grid().nativeElement,
      scroller: this.scroller().nativeElement,
      itemSelector: CARD_SELECTOR,
      gap: GRID_GAP,
      onDrop: (index) => this.moveTo(group.sourceId, index),
    }));
  }

  private moveTo(sourceId: string, index: number): void {
    const order = this.groups().map((g) => g.sourceId);
    const before = order.slice(0, index).filter((id) => id !== sourceId);
    const after = order.slice(index).filter((id) => id !== sourceId);
    this.transitions.run(() => this.documentStore.reorderSources([...before, sourceId, ...after]));
  }

  protected moveBy(group: DocumentGroup, delta: -1 | 1): void {
    const order = this.groups().map((g) => g.sourceId);
    const i = order.indexOf(group.sourceId);
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.transitions.run(() => this.documentStore.reorderSources(order));
  }

  protected rotate(group: DocumentGroup): void {
    this.actions.rotate(
      90,
      group.pages.map((p) => p.id),
    );
  }

  protected remove(group: DocumentGroup): void {
    this.transitions.run(() => this.actions.delete(group.pages.map((p) => p.id)));
  }
}
