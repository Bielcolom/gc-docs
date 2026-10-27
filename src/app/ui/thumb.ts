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
      const key = `${p.srcId}:${p.srcIndex}`;
      untracked(() => {
        if (key === this.renderedFor) return;
        this.renderedFor = key;
        this.render(p);
      });
    });
  }

  private async render(p: PageRef): Promise<void> {
    try {
      const page = await this.store.getPdfPage(p.srcId, p.srcIndex);
      const scale = (170 / Math.max(p.w, p.h)) * Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale });
      const c = this.canvas().nativeElement;
      c.width = Math.ceil(vp.width);
      c.height = Math.ceil(vp.height);
      await page.render({ canvas: c, viewport: vp, background: '#ffffff' }).promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.warn(e);
      this.renderedFor = '';
    }
  }
}
