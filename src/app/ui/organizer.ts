import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { PageRef } from '../core/models';
import { clamp } from '../core/util';
import { Icon } from './icon';
import { PageActions } from './page-actions';
import { Thumb } from './thumb';
import { UiService } from './ui.service';

/** Colores para distinguir de qué PDF viene cada página. */
export const DOC_COLORS = ['#2a6fdb', '#e0a800', '#1f9d55', '#d9480f', '#8e3fb8', '#0f8a7e', '#c2255c', '#6b5d2a', '#4a4f55', '#5c7cfa'];

interface DragState {
  kind: 'pages' | 'docs';
  ids: string[];
  x: number;
  y: number;
  preview: PageRef;
}

const SIZE_KEY = 'gcdocs.organizerSize';

@Component({
  selector: 'app-organizer',
  imports: [Icon, Thumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organizer.html',
  styleUrl: './organizer.css',
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class Organizer {
  protected readonly store = inject(DocumentStore);
  protected readonly ui = inject(UiService);
  protected readonly actions = inject(PageActions);
  private readonly appRef = inject(ApplicationRef);

  private readonly scrollerRef = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  private readonly gridRef = viewChild.required<ElementRef<HTMLDivElement>>('grid');

  protected readonly mode = signal<'pages' | 'docs'>('pages');
  protected readonly size = signal(this.loadSize());
  protected readonly drag = signal<DragState | null>(null);
  protected readonly indicator = signal<{ left: number; top: number; height: number } | null>(null);
  protected readonly marquee = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  protected readonly moveTo = signal('');

  private dropIndex: number | null = null;
  private anchor: string | null = null;
  private lastPointer = { x: 0, y: 0 };
  private scrollRaf = 0;

  protected readonly pages = this.store.pages;
  protected readonly docs = this.store.documents;
  protected readonly selected = this.store.selectedPages;
  protected readonly selCount = computed(() => this.selected().size);
  protected readonly colorOf = computed(() => {
    // Color estable por archivo (orden en que se abrió), para que no cambie al reordenar
    this.docs();
    const map = new Map<string, string>();
    this.store.sourceList().forEach((src, i) => map.set(src.info.id, DOC_COLORS[i % DOC_COLORS.length]));
    return map;
  });
  /** Animar los cambios de orden solo si no son demasiadas páginas. */
  protected readonly animate = computed(() => this.pages().length <= 160);

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.scrollRaf));
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  private loadSize(): number {
    try {
      const v = Number(localStorage.getItem(SIZE_KEY));
      if (v >= 90 && v <= 300) return v;
    } catch {
      /* sin almacenamiento */
    }
    return typeof window !== 'undefined' && window.innerWidth < 700 ? 110 : 150;
  }

  protected setSize(v: number): void {
    this.size.set(v);
    try {
      localStorage.setItem(SIZE_KEY, String(v));
    } catch {
      /* sin almacenamiento */
    }
  }

  protected selectedIds(): string[] {
    const sel = this.selected();
    return this.pages()
      .filter((p) => sel.has(p.id))
      .map((p) => p.id);
  }

  protected setSelection(ids: Iterable<string>): void {
    this.store.selectedPages.set(new Set(ids));
  }

  protected selectAll(): void {
    this.setSelection(this.pages().map((p) => p.id));
  }

  protected clearSelection(): void {
    this.setSelection([]);
  }

  protected selectDoc(srcId: string, additive: boolean): void {
    const ids = this.pages()
      .filter((p) => p.srcId === srcId)
      .map((p) => p.id);
    this.setSelection(additive ? [...this.selected(), ...ids] : ids);
  }

  /** Ejecuta un cambio de orden con una transición animada cuando el navegador la admite. */
  private withTransition(change: () => void): void {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!this.animate() || reduce || !doc.startViewTransition) {
      change();
      return;
    }
    doc.startViewTransition(() => {
      change();
      this.appRef.tick();
    });
  }

  protected openPage(index: number): void {
    this.ui.view.set('edit');
    this.store.currentPage.set(index);
    setTimeout(() => this.store.requestScroll(index), 30);
  }

  protected docName(srcId: string): string {
    return this.store.sourceName(srcId);
  }

  // ---------------------------------------------------------------------------
  // Acciones sobre la selección
  // ---------------------------------------------------------------------------

  protected rotate(delta: 90 | -90, ids = this.selectedIds()): void {
    if (ids.length) this.store.rotatePages(ids, delta);
  }

  protected duplicate(): void {
    const ids = this.selectedIds();
    if (ids.length) this.withTransition(() => this.store.duplicatePages(ids));
  }

  protected remove(ids = this.selectedIds()): void {
    if (!ids.length) return;
    if (ids.length >= this.pages().length) {
      this.ui.toast('No puedes eliminar todas las páginas', 'error');
      return;
    }
    this.withTransition(() => this.store.deletePages(ids));
    this.ui.toast(ids.length === 1 ? 'Página eliminada' : `${ids.length} páginas eliminadas`);
  }

  protected toStart(): void {
    const ids = this.selectedIds();
    if (ids.length) this.withTransition(() => this.store.placePages(ids, 0));
  }

  protected toEnd(): void {
    const ids = this.selectedIds();
    if (ids.length) this.withTransition(() => this.store.placePages(ids, this.pages().length));
  }

  protected shift(dir: -1 | 1): void {
    const ids = this.selectedIds();
    if (ids.length) this.withTransition(() => this.store.shiftPages(ids, dir));
  }

  protected applyMoveTo(): void {
    const ids = this.selectedIds();
    const n = parseInt(this.moveTo(), 10);
    if (!ids.length || Number.isNaN(n)) return;
    const max = this.pages().length - ids.length + 1;
    const pos = clamp(n, 1, max);
    this.withTransition(() => this.store.placePages(ids, pos - 1));
    this.moveTo.set('');
    this.ui.toast(ids.length === 1 ? `Página movida a la posición ${pos}` : `${ids.length} páginas movidas a partir de la posición ${pos}`, 'ok');
  }

  protected extract(): void {
    this.actions.extractTarget();
  }

  // Documentos
  protected rotateDoc(srcId: string): void {
    this.store.rotatePages(
      this.pages()
        .filter((p) => p.srcId === srcId)
        .map((p) => p.id),
      90,
    );
  }

  protected removeDoc(srcId: string): void {
    const ids = this.pages()
      .filter((p) => p.srcId === srcId)
      .map((p) => p.id);
    this.remove(ids);
  }

  protected moveDoc(srcId: string, dir: -1 | 1): void {
    const order = this.docs().map((d) => d.srcId);
    const i = order.indexOf(srcId);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.withTransition(() => this.store.reorderDocuments(order));
  }

  protected sortDocs(dir: 'asc' | 'desc'): void {
    this.withTransition(() => this.store.sortDocuments(dir));
  }

  protected reverse(): void {
    if (this.mode() === 'docs') {
      this.withTransition(() => this.store.reorderDocuments(this.docs().map((d) => d.srcId).reverse()));
    } else {
      this.withTransition(() => this.store.reversePages());
    }
  }

  protected showDocPages(srcId: string): void {
    this.mode.set('pages');
    this.selectDoc(srcId, false);
    const first = this.pages().findIndex((p) => p.srcId === srcId);
    setTimeout(() => this.gridRef().nativeElement.querySelectorAll('[data-item]')[first]?.scrollIntoView({ block: 'center' }), 30);
  }

  // ---------------------------------------------------------------------------
  // Selección con el ratón
  // ---------------------------------------------------------------------------

  private clickSelect(id: string, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): void {
    const pages = this.pages();
    if (e.shiftKey && this.anchor) {
      const a = pages.findIndex((p) => p.id === this.anchor);
      const b = pages.findIndex((p) => p.id === id);
      const [from, to] = a < b ? [a, b] : [b, a];
      const base = e.ctrlKey || e.metaKey ? [...this.selected()] : [];
      this.setSelection([...base, ...pages.slice(from, to + 1).map((p) => p.id)]);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const sel = new Set(this.selected());
      if (sel.has(id)) sel.delete(id);
      else sel.add(id);
      this.setSelection(sel);
    } else {
      this.setSelection([id]);
    }
    this.anchor = id;
  }

  protected toggle(e: Event, id: string): void {
    e.stopPropagation();
    const sel = new Set(this.selected());
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    this.anchor = id;
    this.setSelection(sel);
  }

  // ---------------------------------------------------------------------------
  // Arrastrar y soltar (ratón, lápiz y táctil desde el asa)
  // ---------------------------------------------------------------------------

  protected onItemDown(e: PointerEvent, kind: 'pages' | 'docs', id: string): void {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const fromGrip = !!target.closest('.grip');
    if (target.closest('button:not(.grip), input')) return;
    // En pantallas táctiles solo se arrastra desde el asa, para no impedir el desplazamiento
    if (e.pointerType === 'touch' && !fromGrip) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    const move = (ev: PointerEvent) => {
      this.lastPointer = { x: ev.clientX, y: ev.clientY };
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        dragging = true;
        this.beginDrag(kind, id, ev);
      }
      this.drag.update((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      this.updateDrop();
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (dragging) this.endDrag(ev.type === 'pointerup');
      else if (kind === 'pages') this.clickSelect(id, ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  private beginDrag(kind: 'pages' | 'docs', id: string, e: PointerEvent): void {
    let ids: string[];
    let preview: PageRef;
    if (kind === 'pages') {
      if (!this.selected().has(id)) {
        if (e.ctrlKey || e.metaKey) this.setSelection([...this.selected(), id]);
        else this.setSelection([id]);
        this.anchor = id;
      }
      ids = this.selectedIds();
      preview = this.pages().find((p) => p.id === id)!;
    } else {
      ids = [id];
      preview = this.docs().find((d) => d.srcId === id)!.pages[0];
    }
    this.drag.set({ kind, ids, x: e.clientX, y: e.clientY, preview });
    document.body.classList.add('is-dragging');
    this.autoScroll();
  }

  private endDrag(commit: boolean): void {
    const d = this.drag();
    const at = this.dropIndex;
    this.drag.set(null);
    this.indicator.set(null);
    this.dropIndex = null;
    cancelAnimationFrame(this.scrollRaf);
    document.body.classList.remove('is-dragging');
    if (!d || at === null || !commit) return;
    if (d.kind === 'pages') {
      this.withTransition(() => this.store.movePages(d.ids, at));
    } else {
      const order = this.docs().map((x) => x.srcId);
      const moving = d.ids[0];
      const before = order.slice(0, at).filter((x) => x !== moving);
      const after = order.slice(at).filter((x) => x !== moving);
      this.withTransition(() => this.store.reorderDocuments([...before, moving, ...after]));
    }
  }

  /** Calcula dónde caerían los elementos según la posición del puntero en la cuadrícula. */
  private updateDrop(): void {
    const grid = this.gridRef().nativeElement;
    const items = [...grid.querySelectorAll<HTMLElement>('[data-item]')];
    if (!items.length) return;
    const { x, y } = this.lastPointer;
    const g = grid.getBoundingClientRect();
    const rects = items.map((el) => el.getBoundingClientRect());
    const gap = 14;

    let index: number | null = null;
    let ref = 0;
    let side: 'before' | 'after' = 'before';
    const row = rects.map((r, i) => ({ r, i })).filter(({ r }) => y >= r.top - gap / 2 && y <= r.bottom + gap / 2);
    if (row.length) {
      const hit = row.find(({ r }) => x < r.left + r.width / 2);
      if (hit) {
        index = hit.i;
        ref = hit.i;
        side = 'before';
      } else {
        const last = row[row.length - 1];
        index = last.i + 1;
        ref = last.i;
        side = 'after';
      }
    } else if (y > rects[rects.length - 1].bottom) {
      index = items.length;
      ref = items.length - 1;
      side = 'after';
    } else if (y < rects[0].top) {
      index = 0;
      ref = 0;
      side = 'before';
    }
    if (index === null) return;
    this.dropIndex = index;
    const r = rects[ref];
    const left = (side === 'before' ? r.left - gap / 2 : r.right + gap / 2) - g.left;
    this.indicator.set({ left, top: r.top - g.top, height: r.height });
  }

  private autoScroll(): void {
    const step = () => {
      if (!this.drag()) return;
      const sc = this.scrollerRef().nativeElement;
      const r = sc.getBoundingClientRect();
      const { y } = this.lastPointer;
      const zone = 80;
      let dy = 0;
      if (y < r.top + zone) dy = -Math.ceil(((r.top + zone - y) / zone) * 18);
      else if (y > r.bottom - zone) dy = Math.ceil(((y - (r.bottom - zone)) / zone) * 18);
      if (dy) {
        sc.scrollTop += dy;
        this.updateDrop();
      }
      this.scrollRaf = requestAnimationFrame(step);
    };
    this.scrollRaf = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------
  // Selección por recuadro
  // ---------------------------------------------------------------------------

  protected onBackgroundDown(e: PointerEvent): void {
    const t = e.target as HTMLElement;
    if (e.button !== 0 || t.closest('[data-item]') || this.mode() !== 'pages') return;
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    const grid = this.gridRef().nativeElement;
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    const base = additive ? new Set(this.selected()) : new Set<string>();
    const g0 = grid.getBoundingClientRect();
    const start = { x: e.clientX - g0.left, y: e.clientY - g0.top };
    let moved = false;

    const update = () => {
      const g = grid.getBoundingClientRect();
      const cur = { x: this.lastPointer.x - g.left, y: this.lastPointer.y - g.top };
      const sy = start.y;
      const rect = {
        x: Math.min(start.x, cur.x),
        y: Math.min(sy, cur.y),
        w: Math.abs(cur.x - start.x),
        h: Math.abs(cur.y - sy),
      };
      this.marquee.set(rect);
      const ids = new Set(base);
      grid.querySelectorAll<HTMLElement>('[data-item]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const ix = r.left - g.left;
        const iy = r.top - g.top;
        if (ix < rect.x + rect.w && ix + r.width > rect.x && iy < rect.y + rect.h && iy + r.height > rect.y) ids.add(el.dataset['item']!);
      });
      this.setSelection(ids);
    };
    const move = (ev: PointerEvent) => {
      this.lastPointer = { x: ev.clientX, y: ev.clientY };
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
      moved = true;
      update();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.marquee.set(null);
      if (!moved && !additive) this.clearSelection();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---------------------------------------------------------------------------
  // Teclado
  // ---------------------------------------------------------------------------

  protected onKey(e: KeyboardEvent): void {
    if (this.ui.view() !== 'organize' || this.ui.dialog()) return;
    const t = e.target as HTMLElement;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const hasSel = this.selCount() > 0;
    if (mod && key === 'a') {
      e.preventDefault();
      this.selectAll();
    } else if (mod && key === 'd' && hasSel) {
      e.preventDefault();
      this.duplicate();
    } else if ((key === 'delete' || key === 'backspace') && hasSel) {
      e.preventDefault();
      this.remove();
    } else if (key === 'escape') {
      if (hasSel) this.clearSelection();
      else this.ui.view.set('edit');
    } else if (e.altKey && (key === 'arrowleft' || key === 'arrowup') && hasSel) {
      e.preventDefault();
      this.shift(-1);
    } else if (e.altKey && (key === 'arrowright' || key === 'arrowdown') && hasSel) {
      e.preventDefault();
      this.shift(1);
    } else if (!mod && key === 'r' && hasSel) {
      this.rotate(e.shiftKey ? -90 : 90);
    } else if (key === 'enter' && hasSel) {
      this.openPage(this.pages().findIndex((p) => this.selected().has(p.id)));
    }
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected num(e: Event): number {
    return parseFloat((e.target as HTMLInputElement).value);
  }
}
