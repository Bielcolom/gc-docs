import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { TextLine, getTextLines, normalizeForSearch } from '../core/text-extract';
import { Icon } from './icon';
import { Thumb } from './thumb';
import { UiService } from './ui.service';
import { PageActions } from './page-actions';

interface Hit {
  pageId: string;
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  before: string;
  match: string;
  after: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [Icon, Thumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  protected readonly store = inject(DocumentStore);
  protected readonly ui = inject(UiService);
  protected readonly actions = inject(PageActions);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly dragIds = signal<string[] | null>(null);
  protected readonly dropIndex = signal<number | null>(null);
  private anchor: string | null = null;

  protected readonly query = signal('');
  protected readonly hits = signal<Hit[]>([]);
  protected readonly searching = signal(false);
  private searchSeq = 0;

  protected readonly selectionCount = computed(() => this.store.selectedPages().size);
  protected readonly editedPages = computed(() => {
    const s = new Set<string>();
    for (const a of this.store.annots()) s.add(a.pageId);
    return s;
  });

  constructor() {
    effect(() => {
      if (this.ui.leftTab() === 'search') setTimeout(() => this.searchInput()?.nativeElement.focus(), 30);
    });
    // Si el documento cambia, rehacer la búsqueda
    effect(() => {
      this.store.pages();
      const q = this.query();
      if (q.trim().length >= 2) this.runSearch(q);
    });
  }

  // ---------------- Miniaturas ----------------

  protected onThumbClick(e: MouseEvent, id: string, index: number): void {
    const sel = new Set(this.store.selectedPages());
    const pages = this.store.pages();
    if (e.shiftKey && this.anchor) {
      const a = pages.findIndex((p) => p.id === this.anchor);
      const [from, to] = a < index ? [a, index] : [index, a];
      for (let i = from; i <= to; i++) sel.add(pages[i].id);
      this.store.selectedPages.set(sel);
    } else if (e.ctrlKey || e.metaKey) {
      if (sel.has(id)) sel.delete(id);
      else sel.add(id);
      this.anchor = id;
      this.store.selectedPages.set(sel);
    } else {
      this.anchor = id;
      this.store.selectedPages.set(new Set());
      this.store.requestScroll(index);
    }
  }

  protected toggleSelect(e: Event, id: string): void {
    e.stopPropagation();
    const sel = new Set(this.store.selectedPages());
    if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    this.anchor = id;
    this.store.selectedPages.set(sel);
  }

  protected onDragStart(e: DragEvent, id: string): void {
    const sel = this.store.selectedPages();
    const ids = sel.has(id) ? this.store.pages().filter((p) => sel.has(p.id)).map((p) => p.id) : [id];
    this.dragIds.set(ids);
    e.dataTransfer?.setData('text/plain', ids.join(','));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(e: DragEvent, index: number): void {
    if (!this.dragIds()) {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        this.dropIndex.set(e.clientY < r.top + r.height / 2 ? index : index + 1);
      }
      return;
    }
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.dropIndex.set(e.clientY < r.top + r.height / 2 ? index : index + 1);
  }

  protected async onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    const ids = this.dragIds();
    const at = this.dropIndex();
    this.dragIds.set(null);
    this.dropIndex.set(null);
    if (at === null) return;
    if (ids) {
      this.store.movePages(ids, at);
      return;
    }
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) {
      const n = await this.store.addFiles(files, at);
      if (n) this.ui.toast(`${n} ${n === 1 ? 'página añadida' : 'páginas añadidas'}`, 'ok');
    }
  }

  protected onDragEnd(): void {
    this.dragIds.set(null);
    this.dropIndex.set(null);
  }

  protected clearSelection(): void {
    this.store.selectedPages.set(new Set());
  }

  protected rotate(e: Event, id: string, d: 90 | -90): void {
    e.stopPropagation();
    this.store.rotatePages([id], d);
  }

  protected remove(e: Event, id: string): void {
    e.stopPropagation();
    if (this.store.pages().length <= 1) {
      this.ui.toast('El documento necesita al menos una página', 'error');
      return;
    }
    this.store.deletePages([id]);
  }

  // ---------------- Búsqueda ----------------

  protected onQuery(v: string): void {
    this.query.set(v);
    if (v.trim().length < 2) {
      this.hits.set([]);
      this.store.searchHits.set([]);
      this.store.activeHit.set(-1);
    }
  }

  private async runSearch(q: string): Promise<void> {
    const seq = ++this.searchSeq;
    this.searching.set(true);
    const needle = normalizeForSearch(q.trim());
    const pages = this.store.pages();
    const out: Hit[] = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const pdfPage = await this.store.getPdfPage(p.srcId, p.srcIndex);
      const lines = await getTextLines(pdfPage, p.vt);
      if (seq !== this.searchSeq) return;
      for (const line of lines) {
        const hay = normalizeForSearch(line.str);
        let from = 0;
        for (;;) {
          const at = hay.indexOf(needle, from);
          if (at < 0) break;
          from = at + needle.length;
          const x1 = charX(line, at);
          const x2 = charX(line, at + needle.length);
          out.push({
            pageId: p.id,
            pageIndex: i,
            x: x1,
            y: line.y,
            w: Math.max(2, x2 - x1),
            h: line.h,
            before: line.str.slice(Math.max(0, at - 28), at),
            match: line.str.slice(at, at + needle.length),
            after: line.str.slice(at + needle.length, at + needle.length + 40),
          });
        }
      }
    }
    if (seq !== this.searchSeq) return;
    this.hits.set(out);
    this.store.searchHits.set(out.map(({ pageId, x, y, w, h }) => ({ pageId, x, y, w, h })));
    this.store.activeHit.set(out.length ? 0 : -1);
    this.searching.set(false);
  }

  protected go(i: number): void {
    const hits = this.hits();
    if (!hits.length) return;
    const idx = ((i % hits.length) + hits.length) % hits.length;
    this.store.activeHit.set(idx);
    const h = hits[idx];
    this.store.requestScroll(h.pageIndex, h.y);
  }

  protected onSearchKey(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      this.go(this.store.activeHit() + (e.shiftKey ? -1 : 1));
    }
    if (e.key === 'Escape') (e.target as HTMLElement).blur();
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
}

function charX(line: TextLine, index: number): number {
  for (const s of line.segments) {
    if (index >= s.start && index <= s.end) {
      const len = Math.max(1, s.end - s.start);
      return s.x + (s.w * (index - s.start)) / len;
    }
  }
  return index <= 0 ? line.x : line.x + line.w;
}
