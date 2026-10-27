import { Injectable, signal } from '@angular/core';
import type { Rect } from '@core/models';
import { rectsIntersect, trackPointer } from '@core/utils';

export interface MarqueeOptions {
  readonly grid: HTMLElement;
  readonly itemSelector: string;
  /** Atributo `data-*` del elemento con su id. */
  readonly idAttribute: string;
  /** Ids que ya estaban seleccionados (si el usuario añade a la selección). */
  readonly initial: ReadonlySet<string>;
  readonly onChange: (ids: Set<string>) => void;
  /** Clic sin arrastrar en el fondo. */
  readonly onClick: () => void;
}

/** Selección de varios elementos dibujando un recuadro con el ratón. */
@Injectable()
export class MarqueeSelectionService {
  readonly rect = signal<Rect | null>(null);

  start(event: PointerEvent, options: MarqueeOptions): void {
    const origin = options.grid.getBoundingClientRect();
    const start = { x: event.clientX - origin.left, y: event.clientY - origin.top };
    trackPointer(event, {
      onMove: (move) => {
        const grid = options.grid.getBoundingClientRect();
        const current = { x: move.clientX - grid.left, y: move.clientY - grid.top };
        const rect: Rect = {
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          w: Math.abs(current.x - start.x),
          h: Math.abs(current.y - start.y),
        };
        this.rect.set(rect);
        const ids = new Set(options.initial);
        for (const el of options.grid.querySelectorAll<HTMLElement>(options.itemSelector)) {
          const box = el.getBoundingClientRect();
          const itemRect = {
            x: box.left - grid.left,
            y: box.top - grid.top,
            w: box.width,
            h: box.height,
          };
          const id = el.dataset[options.idAttribute];
          if (id && rectsIntersect(rect, itemRect)) ids.add(id);
        }
        options.onChange(ids);
      },
      onEnd: (_end, dragged) => {
        this.rect.set(null);
        if (!dragged) options.onClick();
      },
    });
  }
}
