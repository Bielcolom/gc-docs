import { DOCUMENT, Injectable, type OnDestroy, inject, signal } from '@angular/core';
import type { PageRef } from '@core/models';
import { computeDropTarget, trackPointer, type ItemBox } from '@core/utils';

export interface DragPreview {
  readonly ids: readonly string[];
  readonly page: PageRef;
  readonly label?: string;
  readonly x: number;
  readonly y: number;
}

export interface DropIndicator {
  readonly left: number;
  readonly top: number;
  readonly height: number;
}

export interface GridDragOptions {
  readonly ids: readonly string[];
  readonly preview: PageRef;
  readonly label?: string;
  /** Cuadrícula que contiene los elementos (sirve de referencia para el indicador). */
  readonly grid: HTMLElement;
  /** Contenedor con scroll, para desplazarse solo al acercarse a los bordes. */
  readonly scroller: HTMLElement;
  /** Selector CSS de los elementos de la cuadrícula, en orden. */
  readonly itemSelector: string;
  readonly gap: number;
  /** Se llama al soltar, con la posición de inserción (0..n). */
  readonly onDrop: (index: number) => void;
}

const AUTOSCROLL_ZONE = 80;
const AUTOSCROLL_MAX_SPEED = 18;

/**
 * Arrastrar y soltar en una cuadrícula con varios elementos a la vez.
 * Angular CDK solo arrastra un elemento; aquí se arrastra la selección completa,
 * con un indicador de inserción y desplazamiento automático.
 *
 * Se provee en el componente que lo usa (`providers`), así cada cuadrícula tiene su propio estado.
 */
@Injectable()
export class GridDragDropService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  readonly preview = signal<DragPreview | null>(null);
  readonly indicator = signal<DropIndicator | null>(null);

  private pointer = { x: 0, y: 0 };
  private dropIndex: number | null = null;
  private frame = 0;

  /** Empieza a seguir el puntero; el arrastre comienza de verdad al superar el umbral. */
  track(
    event: PointerEvent,
    options: () => GridDragOptions,
    onClick?: (event: PointerEvent) => void,
  ): void {
    let active: GridDragOptions | null = null;
    trackPointer(event, {
      threshold: 6,
      onMove: (move) => {
        this.pointer = { x: move.clientX, y: move.clientY };
        if (!active) {
          active = options();
          this.document.body.classList.add('is-dragging');
          this.autoScroll(active);
        }
        this.preview.set({
          ids: active.ids,
          page: active.preview,
          label: active.label,
          x: move.clientX,
          y: move.clientY,
        });
        this.updateDropTarget(active);
      },
      onEnd: (end, dragged) => {
        if (!dragged || !active) {
          onClick?.(end);
          return;
        }
        const index = this.dropIndex;
        this.reset();
        if (end.type === 'pointerup' && index !== null) active.onDrop(index);
      },
    });
  }

  ngOnDestroy(): void {
    this.reset();
  }

  private updateDropTarget(options: GridDragOptions): void {
    const items = [...options.grid.querySelectorAll<HTMLElement>(options.itemSelector)];
    const boxes: ItemBox[] = items.map((el) => el.getBoundingClientRect());
    const target = computeDropTarget(boxes, this.pointer, options.gap);
    if (!target) return;
    this.dropIndex = target.index;
    const grid = options.grid.getBoundingClientRect();
    const box = boxes[target.anchor];
    const edge =
      target.side === 'before' ? box.left - options.gap / 2 : box.right + options.gap / 2;
    this.indicator.set({
      left: edge - grid.left,
      top: box.top - grid.top,
      height: box.bottom - box.top,
    });
  }

  private autoScroll(options: GridDragOptions): void {
    const step = () => {
      if (!this.preview()) return;
      const area = options.scroller.getBoundingClientRect();
      const { y } = this.pointer;
      let delta = 0;
      if (y < area.top + AUTOSCROLL_ZONE)
        delta = -Math.ceil(
          ((area.top + AUTOSCROLL_ZONE - y) / AUTOSCROLL_ZONE) * AUTOSCROLL_MAX_SPEED,
        );
      else if (y > area.bottom - AUTOSCROLL_ZONE)
        delta = Math.ceil(
          ((y - area.bottom + AUTOSCROLL_ZONE) / AUTOSCROLL_ZONE) * AUTOSCROLL_MAX_SPEED,
        );
      if (delta) {
        options.scroller.scrollTop += delta;
        this.updateDropTarget(options);
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private reset(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.preview.set(null);
    this.indicator.set(null);
    this.dropIndex = null;
    this.document.body.classList.remove('is-dragging');
  }
}
