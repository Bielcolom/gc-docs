import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { PageRef } from '../core/models';

@Component({
  selector: 'app-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="frame" [style.aspect-ratio]="ratio()">
    <canvas #c [style.transform]="'rotate(' + page().rotation + 'deg)'" [style.width.%]="cw()" [style.height.%]="ch()"></canvas>
  </div>`,
  styles: `
    :host {
      display: block;
    }
    .frame {
      position: relative;
      width: 100%;
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    canvas {
      background: #fff;
      display: block;
      position: absolute;
      left: 50%;
      top: 50%;
      translate: -50% -50%;
    }
  `,
})
export class Thumb {
  readonly page = input.required<PageRef>();
  /** Resolución (px del lado mayor) a la que se dibuja la miniatura. */
  readonly res = input(170);
  private readonly store = inject(DocumentStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('c');
  private readonly visible = signal(false);
  private renderedFor = '';

  protected ratio(): string {
    const p = this.page();
    return p.rotation % 180 ? `${p.h} / ${p.w}` : `${p.w} / ${p.h}`;
  }
  /** Tamaño del lienzo (sin rotar) en % del marco */
  protected cw(): number {
    const p = this.page();
    return p.rotation % 180 ? (p.w / p.h) * 100 : 100;
  }
  protected ch(): number {
    const p = this.page();
    return p.rotation % 180 ? (p.h / p.w) * 100 : 100;
  }

  constructor() {
    const io = new IntersectionObserver((es) => es.forEach((e) => this.visible.set(e.isIntersecting)), { rootMargin: '300px 0px' });
    queueMicrotask(() => io.observe(this.host.nativeElement));
    inject(DestroyRef).onDestroy(() => io.disconnect());

    effect(() => {
      if (!this.visible()) return;
      const p = this.page();
      const res = Math.ceil(this.res() / 60) * 60;
      const key = `${p.srcId}:${p.srcIndex}:${res}`;
      untracked(() => {
        if (key === this.renderedFor) return;
        this.renderedFor = key;
        this.render(p, res);
      });
    });
  }

  private seq = 0;

  private async render(p: PageRef, res: number): Promise<void> {
    const seq = ++this.seq;
    try {
      const page = await this.store.getPdfPage(p.srcId, p.srcIndex);
      const scale = (res / Math.max(p.w, p.h)) * Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale });
      // Se dibuja en un lienzo aparte para no pisar un render anterior que siga en marcha
      const off = document.createElement('canvas');
      off.width = Math.ceil(vp.width);
      off.height = Math.ceil(vp.height);
      await page.render({ canvas: off, viewport: vp, background: '#ffffff' }).promise;
      if (seq !== this.seq) return;
      const c = this.canvas().nativeElement;
      c.width = off.width;
      c.height = off.height;
      c.getContext('2d')!.drawImage(off, 0, 0);
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.warn(e);
      this.renderedFor = '';
    }
  }
}
