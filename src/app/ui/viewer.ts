import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, untracked, viewChild } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { clamp } from '../core/util';
import { PageView } from './page-view';
import { UiService } from './ui.service';

export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

@Component({
  selector: 'app-viewer',
  imports: [PageView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="scroller"
      #scroller
      (scroll)="onScroll()"
      (wheel)="onWheel($event)"
      (dragover)="onDragOver($event)"
      (drop)="onDrop($event)"
      (pointerdown)="onBackgroundDown($event)"
    >
      <div class="stack">
        @for (p of store.pages(); track p.id; let i = $index) {
          <div class="slot">
            <app-page-view [page]="p" [index]="i" [zoom]="store.zoom()" />
            <div class="label">{{ i + 1 }} <span>de {{ store.pages().length }}</span></div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      min-width: 0;
      min-height: 0;
    }
    .scroller {
      position: absolute;
      inset: 0;
      overflow: auto;
      overscroll-behavior: contain;
    }
    .stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 28px 24px 120px;
      min-width: min-content;
    }
    .slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .label {
      font-size: 12px;
      color: var(--ink-3);
      font-variant-numeric: tabular-nums;
      margin-bottom: 14px;
    }
    .label span {
      opacity: 0.7;
    }
    @media (max-width: 700px) {
      .stack {
        padding: 16px 10px 140px;
      }
    }
  `,
})
export class Viewer {
  protected readonly store = inject(DocumentStore);
  private readonly ui = inject(UiService);
  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  private lastFitPages = 0;
  private scrollRaf = 0;

  constructor() {
    // Desplazamiento solicitado (miniaturas, búsqueda…)
    effect(() => {
      const req = this.store.scrollRequest();
      if (!req) return;
      untracked(() => setTimeout(() => this.scrollTo(req.index, req.y), 0));
    });

    // Ajustar al ancho al abrir un documento nuevo
    effect(() => {
      const n = this.store.pages().length;
      const first = this.store.pages()[0]?.id;
      untracked(() => {
        if (n && this.lastFitPages === 0) setTimeout(() => this.fit('width', true), 0);
        this.lastFitPages = n;
      });
      void first;
    });

    effect(() => {
      const req = this.store.fitRequest();
      if (req) untracked(() => this.fit(req.mode, false));
    });

    // Mantener la página actual al cambiar el zoom
    let prevZoom = this.store.zoom();
    effect(() => {
      const z = this.store.zoom();
      untracked(() => {
        const el = this.scroller().nativeElement;
        if (prevZoom && z !== prevZoom) {
          const k = z / prevZoom;
          const top = el.scrollTop;
          const left = el.scrollLeft;
          requestAnimationFrame(() => {
            el.scrollTop = (top + el.clientHeight / 2) * k - el.clientHeight / 2;
            el.scrollLeft = (left + el.clientWidth / 2) * k - el.clientWidth / 2;
          });
        }
        prevZoom = z;
      });
    });
  }

  fit(mode: 'width' | 'page', onlyShrink: boolean): void {
    const el = this.scroller().nativeElement;
    const pages = this.store.pages();
    if (!pages.length) return;
    const ref = pages[Math.min(this.store.currentPage(), pages.length - 1)];
    const w = ref.rotation % 180 ? ref.h : ref.w;
    const h = ref.rotation % 180 ? ref.w : ref.h;
    const availW = el.clientWidth - (el.clientWidth < 700 ? 20 : 56);
    const availH = el.clientHeight - 80;
    let z = mode === 'width' ? availW / w : Math.min(availW / w, availH / h);
    if (onlyShrink) z = Math.min(z, 1.25);
    this.store.zoom.set(clamp(Math.round(z * 100) / 100, 0.2, 5));
    // Si alguna página es más ancha (p. ej. apaisada), centrar el desplazamiento horizontal
    setTimeout(() => requestAnimationFrame(() => (el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2))), 30);
  }

  private scrollTo(index: number, y?: number): void {
    const el = this.scroller().nativeElement;
    const slot = el.querySelectorAll<HTMLElement>('app-page-view')[index];
    if (!slot) return;
    const top = slot.offsetTop - 20 + (y !== undefined ? y * this.store.zoom() - el.clientHeight / 3 : 0);
    el.scrollTo({ top: Math.max(0, top), behavior: y !== undefined ? 'smooth' : 'auto' });
    this.store.currentPage.set(index);
  }

  protected onScroll(): void {
    cancelAnimationFrame(this.scrollRaf);
    this.scrollRaf = requestAnimationFrame(() => {
      const el = this.scroller().nativeElement;
      const views = el.querySelectorAll<HTMLElement>('app-page-view');
      const mid = el.scrollTop + el.clientHeight * 0.35;
      let best = 0;
      for (let i = 0; i < views.length; i++) {
        if (views[i].offsetTop <= mid) best = i;
        else break;
      }
      if (best !== this.store.currentPage()) this.store.currentPage.set(best);
    });
  }

  protected onWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const z = this.store.zoom();
    const factor = Math.exp(-e.deltaY * 0.0022);
    this.store.zoom.set(clamp(Math.round(z * factor * 100) / 100, 0.2, 5));
  }

  protected onBackgroundDown(e: PointerEvent): void {
    const t = e.target as HTMLElement;
    if (t.classList.contains('scroller') || t.classList.contains('stack') || t.classList.contains('slot')) {
      this.store.selectedId.set(null);
      const active = document.activeElement as HTMLElement | null;
      if (active?.isContentEditable) active.blur();
      this.store.editingId.set(null);
    }
  }

  protected onDragOver(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  protected async onDrop(e: DragEvent): Promise<void> {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    const added = await this.store.addFiles(files);
    if (added) this.ui.toast(`${added} ${added === 1 ? 'página añadida' : 'páginas añadidas'} al final`, 'ok');
  }
}
