import { Injectable, inject, signal } from '@angular/core';
import type { SearchHit } from '@core/models';
import { TextExtractionService } from '@core/pdf';
import { DocumentStore, EditorStore } from '@core/state';
import { findInLine } from '@core/utils';

const MIN_QUERY_LENGTH = 2;
const CONTEXT_BEFORE = 28;
const CONTEXT_AFTER = 40;

/** Búsqueda de texto en todas las páginas, sin distinguir mayúsculas ni tildes. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly documentStore = inject(DocumentStore);
  private readonly editorStore = inject(EditorStore);
  private readonly text = inject(TextExtractionService);
  private searchId = 0;

  readonly query = signal('');
  readonly searching = signal(false);

  readonly minQueryLength = MIN_QUERY_LENGTH;

  async search(query: string): Promise<void> {
    this.query.set(query);
    const id = ++this.searchId;
    if (query.trim().length < MIN_QUERY_LENGTH) {
      this.editorStore.setSearchResults([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    const hits: SearchHit[] = [];
    const pages = this.documentStore.pages();
    for (const [pageIndex, page] of pages.entries()) {
      const lines = await this.text.getLines(page);
      if (id !== this.searchId) return;
      for (const line of lines) {
        for (const match of findInLine(line, query)) {
          hits.push({
            pageId: page.id,
            pageIndex,
            x: match.x,
            y: line.y,
            width: match.width,
            height: line.height,
            before: line.text.slice(Math.max(0, match.start - CONTEXT_BEFORE), match.start),
            match: line.text.slice(match.start, match.end),
            after: line.text.slice(match.end, match.end + CONTEXT_AFTER),
          });
        }
      }
    }
    this.editorStore.setSearchResults(hits);
    this.searching.set(false);
  }

  /** Va al resultado `index` (con vuelta al principio/final). */
  goTo(index: number): void {
    const hits = this.editorStore.searchHits();
    if (!hits.length) return;
    const i = ((index % hits.length) + hits.length) % hits.length;
    this.editorStore.activeHitIndex.set(i);
    this.editorStore.requestScroll(hits[i].pageIndex, hits[i].y);
  }

  next(): void {
    this.goTo(this.editorStore.activeHitIndex() + 1);
  }

  previous(): void {
    this.goTo(this.editorStore.activeHitIndex() - 1);
  }

  /** Repite la búsqueda actual (p. ej. después de cambiar las páginas). */
  refresh(): void {
    void this.search(this.query());
  }
}
