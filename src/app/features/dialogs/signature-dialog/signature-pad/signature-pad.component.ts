import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  drawStroke,
  renderDrawnSignature,
  type SignatureImage,
  type Stroke,
} from '../signature-image';

const PREVIEW_LINE_WIDTH = 2.6;

/** Lienzo para firmar con ratón, dedo o lápiz. */
@Component({
  selector: 'app-signature-pad',
  templateUrl: './signature-pad.component.html',
  styleUrl: './signature-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignaturePadComponent {
  readonly color = input('#111418');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly strokes = signal<readonly Stroke[]>([]);
  readonly isEmpty = signal(true);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvasRef().nativeElement;
      const resize = new ResizeObserver(() => this.fitCanvas());
      resize.observe(canvas);
      destroyRef.onDestroy(() => resize.disconnect());
    });
    // Cambiar el color repinta la firma ya dibujada
    effect(() => {
      this.color();
      this.strokes();
      this.redraw();
    });
  }

  clear(): void {
    this.strokes.set([]);
    this.isEmpty.set(true);
  }

  toImage(): SignatureImage | null {
    const canvas = this.canvasRef().nativeElement;
    return renderDrawnSignature(
      this.strokes(),
      this.color(),
      canvas.width / Math.max(1, canvas.height),
    );
  }

  protected onPointerDown(event: PointerEvent): void {
    const canvas = this.canvasRef().nativeElement;
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const toPoint = (e: PointerEvent) =>
      [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height] as const;
    let current: Stroke = [toPoint(event)];
    this.strokes.update((s) => [...s, current]);

    const move = (e: PointerEvent) => {
      current = [...current, toPoint(e)];
      this.strokes.update((s) => [...s.slice(0, -1), current]);
    };
    const up = () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      this.isEmpty.set(!this.strokes().some((s) => s.length > 1));
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  private fitCanvas(): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * devicePixelRatio);
    canvas.height = Math.round(rect.height * devicePixelRatio);
    this.redraw();
  }

  private redraw(): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = ctx.fillStyle = this.color();
    for (const stroke of this.strokes()) {
      drawStroke(ctx, stroke, PREVIEW_LINE_WIDTH * devicePixelRatio, canvas.width, canvas.height);
    }
  }
}
