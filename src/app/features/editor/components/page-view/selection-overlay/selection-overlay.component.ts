import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Annotation, PathAnnotation } from '@core/models';
import type { ResizeHandle } from '@core/utils';
import { IconComponent } from '@shared/components';

export type SelectionHandle = ResizeHandle | 'start' | 'end';

export interface HandleDragStart {
  readonly handle: SelectionHandle;
  readonly event: PointerEvent;
}

const BOX_HANDLES: readonly ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CORNER_HANDLES: readonly ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];

/** Marco de selección con tiradores y una barra mínima de acciones. */
@Component({
  selector: 'app-selection-overlay',
  imports: [IconComponent],
  templateUrl: './selection-overlay.component.html',
  styleUrl: './selection-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionOverlayComponent {
  readonly annotation = input.required<Annotation>();
  readonly zoom = input.required<number>();

  readonly handleDragStart = output<HandleDragStart>();
  readonly editRequest = output<void>();
  readonly duplicateRequest = output<void>();
  readonly removeRequest = output<void>();

  protected readonly isLine = computed(
    () => this.annotation().type === 'line' || this.annotation().type === 'arrow',
  );
  protected readonly isText = computed(() => this.annotation().type === 'text');

  protected readonly box = computed(() => {
    const { x, y, w, h } = this.annotation();
    const z = this.zoom();
    return { left: x * z, top: y * z, width: w * z, height: h * z };
  });

  protected readonly handles = computed(() => {
    const a = this.annotation();
    const z = this.zoom();
    if (a.type === 'note') return [];
    if (this.isLine()) {
      const path = a as PathAnnotation;
      return (['start', 'end'] as const).map((handle, i) => ({
        handle,
        left: (a.x + path.points[i][0] * a.w) * z,
        top: (a.y + path.points[i][1] * a.h) * z,
      }));
    }
    const handles = a.type === 'text' ? CORNER_HANDLES : BOX_HANDLES;
    return handles.map((handle) => ({
      handle,
      left: (handle.includes('w') ? a.x : handle.includes('e') ? a.x + a.w : a.x + a.w / 2) * z,
      top: (handle.includes('n') ? a.y : handle.includes('s') ? a.y + a.h : a.y + a.h / 2) * z,
    }));
  });

  protected onHandleDown(handle: SelectionHandle, event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.handleDragStart.emit({ handle, event });
  }
}
