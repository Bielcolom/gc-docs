import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FontMetricsService } from '@core/fonts';
import type { Annotation, PathAnnotation, StampAnnotation, SymbolAnnotation } from '@core/models';
import {
  SYMBOL_STROKES,
  arrowHead,
  linePath,
  polylinePath,
  roundedRectPath,
  smoothPath,
} from '@core/utils';
import { IconComponent } from '@shared/components';

type GraphicAnnotation = Exclude<Annotation, { type: 'text' }>;

const STAMP_FONT = 'Helvetica, Arial, sans-serif';
const STAMP_TEXT_RATIO = 0.46;
const STAMP_MAX_TEXT_WIDTH = 0.84;

/**
 * Dibuja una anotación gráfica (todas menos el texto) en su posición.
 * Componente de presentación: no conoce el estado ni gestiona eventos; el padre los recibe del host.
 */
@Component({
  selector: 'app-annotation-view',
  imports: [IconComponent],
  templateUrl: './annotation-view.component.html',
  styleUrl: './annotation-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'annotation annotation--' + annotation().type",
    '[style.left.px]': 'annotation().x * zoom()',
    '[style.top.px]': 'annotation().y * zoom()',
    '[style.width.px]': 'annotation().w * zoom()',
    '[style.height.px]': 'annotation().h * zoom()',
    '[style.opacity]': "annotation().type === 'highlight' ? 1 : annotation().opacity",
  },
})
export class AnnotationViewComponent {
  private readonly metrics = inject(FontMetricsService);

  readonly annotation = input.required<GraphicAnnotation>();
  readonly zoom = input.required<number>();

  protected readonly viewBox = computed(() => `0 0 ${this.annotation().w} ${this.annotation().h}`);

  protected readonly path = computed(() => {
    const a = this.annotation();
    if (a.type !== 'ink' && a.type !== 'line' && a.type !== 'arrow') return null;
    return this.pathData(a);
  });

  protected readonly stamp = computed(() => {
    const a = this.annotation();
    return a.type === 'stamp' ? this.stampLayout(a) : null;
  });

  protected readonly symbolPaths = computed(() => {
    const a = this.annotation();
    return a.type === 'symbol' && a.kind !== 'dot' ? this.symbolStrokes(a) : [];
  });

  private pathData(a: PathAnnotation): { line: string; head: string | null } {
    const points = a.points.map(([x, y]) => [x * a.w, y * a.h] as const);
    if (a.type === 'ink') return { line: smoothPath(points), head: null };
    const line = linePath(points[0], points[1]);
    if (a.type === 'line') return { line, head: null };
    const head = arrowHead(
      { x: points[0][0], y: points[0][1] },
      { x: points[1][0], y: points[1][1] },
      a.strokeWidth,
    );
    return { line, head: polylinePath(head, true) };
  }

  private stampLayout(a: StampAnnotation): { border: number; frame: string; fontSize: number } {
    const border = Math.max(1.5, a.h * 0.07);
    let fontSize = a.h * STAMP_TEXT_RATIO;
    const width = this.metrics.measure(a.label, STAMP_FONT, fontSize, true);
    if (width > a.w * STAMP_MAX_TEXT_WIDTH) fontSize *= (a.w * STAMP_MAX_TEXT_WIDTH) / width;
    return {
      border,
      frame: roundedRectPath(border / 2, border / 2, a.w - border, a.h - border, a.h * 0.18),
      fontSize,
    };
  }

  private symbolStrokes(a: SymbolAnnotation): string[] {
    if (a.kind === 'dot') return [];
    return SYMBOL_STROKES[a.kind].map((stroke) =>
      polylinePath(stroke.map(([x, y]) => [x * a.w, y * a.h] as const)),
    );
  }
}
