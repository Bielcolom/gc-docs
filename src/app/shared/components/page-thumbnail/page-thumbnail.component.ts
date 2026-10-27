import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { PageRef } from '@core/models';
import { PageRenderService, isRenderCancelled } from '@core/pdf';
import { LoggerService } from '@core/services';
import { InViewportDirective } from '../../directives/in-viewport.directive';

/** Píxeles de lienzo por píxel de pantalla (limitado para no gastar memoria). */
const MAX_THUMBNAIL_DPR = 2;
/** La resolución se redondea a escalones para no redibujar con cada pequeño cambio de tamaño. */
const RESOLUTION_STEP = 60;

interface RenderKey {
  readonly sourceId: string;
  readonly sourceIndex: number;
  readonly resolution: number;
}

const sameRenderKey = (a: RenderKey | null, b: RenderKey | null): boolean =>
  a?.sourceId === b?.sourceId &&
  a?.sourceIndex === b?.sourceIndex &&
  a?.resolution === b?.resolution;

/**
 * Miniatura de una página. Solo se dibuja cuando entra en pantalla y respeta la rotación del usuario.
 * La lógica de pintado vive en `PageRenderService`; el componente solo decide cuándo pintar.
 */
@Component({
  selector: 'app-page-thumbnail',
  templateUrl: './page-thumbnail.component.html',
  styleUrl: './page-thumbnail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: InViewportDirective, inputs: ['appInViewportMargin'] }],
})
export class PageThumbnailComponent {
  readonly page = input.required<PageRef>();
  /** Lado mayor de la miniatura, en píxeles de pantalla. */
  readonly resolution = input(170);

  private readonly renderer = inject(PageRenderService);
  private readonly logger = inject(LoggerService);
  private readonly viewport = inject(InViewportDirective);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private readonly isSideways = computed(() => this.page().rotation % 180 !== 0);
  protected readonly aspectRatio = computed(() => {
    const { width, height } = this.page();
    return this.isSideways() ? `${height} / ${width}` : `${width} / ${height}`;
  });
  /** El lienzo se dibuja sin girar; al girarlo con CSS hay que intercambiar sus proporciones. */
  protected readonly canvasWidth = computed(() => {
    const { width, height } = this.page();
    return this.isSideways() ? (width / height) * 100 : 100;
  });
  protected readonly canvasHeight = computed(() => {
    const { width, height } = this.page();
    return this.isSideways() ? (height / width) * 100 : 100;
  });
  protected readonly transform = computed(
    () => `translate(-50%, -50%) rotate(${this.page().rotation}deg)`,
  );

  /** Qué hay que dibujar: cambia con la página de origen o con la resolución, no con la rotación. */
  private readonly renderKey = computed(
    () => {
      if (!this.viewport.isVisible()) return null;
      const { sourceId, sourceIndex } = this.page();
      const resolution = Math.ceil(this.resolution() / RESOLUTION_STEP) * RESOLUTION_STEP;
      return { sourceId, sourceIndex, resolution };
    },
    { equal: sameRenderKey },
  );

  constructor() {
    effect((onCleanup) => {
      const key = this.renderKey();
      if (!key) return;
      const controller = new AbortController();
      onCleanup(() => controller.abort());
      void this.draw(key.resolution, controller.signal);
    });
  }

  private async draw(resolution: number, signal: AbortSignal): Promise<void> {
    const page = this.page();
    const scale =
      (resolution / Math.max(page.width, page.height)) *
      Math.min(devicePixelRatio || 1, MAX_THUMBNAIL_DPR);
    try {
      await this.renderer.renderInto(this.canvas().nativeElement, page, { scale, signal });
    } catch (error) {
      if (!isRenderCancelled(error)) this.logger.warn('No se pudo dibujar la miniatura', error);
    }
  }
}
