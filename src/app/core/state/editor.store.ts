import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DEFAULT_TOOL_STYLE, MAX_ZOOM, MIN_ZOOM, ZOOM_STEPS } from '@core/constants';
import type { SearchHit, ToolId, ToolStyle } from '@core/models';
import { clamp } from '@core/utils';
import { DocumentStore } from './document.store';

export type SidebarTab = 'pages' | 'search';
export type FitMode = 'width' | 'page';

/** Petición de desplazamiento del visor; `nonce` permite repetir la misma petición. */
export interface ScrollRequest {
  readonly pageIndex: number;
  /** Posición vertical dentro de la página, en puntos. */
  readonly y?: number;
  readonly nonce: number;
}

export interface FitRequest {
  readonly mode: FitMode;
  readonly nonce: number;
}

/**
 * Estado de la sesión de edición que no forma parte del documento (no se puede deshacer):
 * herramienta activa, selección, zoom, paneles abiertos, búsqueda…
 */
@Injectable({ providedIn: 'root' })
export class EditorStore {
  private readonly documentStore = inject(DocumentStore);
  private nonce = 0;

  readonly tool = signal<ToolId>('select');
  readonly toolStyle = signal<ToolStyle>(DEFAULT_TOOL_STYLE);
  readonly selectedAnnotationId = signal<string | null>(null);
  readonly editingAnnotationId = signal<string | null>(null);
  readonly selectedPageIds = signal<ReadonlySet<string>>(new Set());
  readonly zoom = signal(1);
  readonly currentPageIndex = signal(0);
  readonly sidebarOpen = signal(true);
  readonly inspectorOpen = signal(true);
  readonly sidebarTab = signal<SidebarTab>('pages');
  readonly scrollRequest = signal<ScrollRequest | null>(null);
  readonly fitRequest = signal<FitRequest | null>(null);
  readonly searchHits = signal<readonly SearchHit[]>([]);
  readonly activeHitIndex = signal(-1);
  /** El visor ya ajustó el zoom al abrir el documento actual. */
  readonly initialFitDone = signal(false);

  readonly selectedAnnotation = computed(() =>
    this.documentStore.findAnnotation(this.selectedAnnotationId()),
  );
  readonly currentPage = computed(() => {
    const pages = this.documentStore.pages();
    return pages[clamp(this.currentPageIndex(), 0, Math.max(0, pages.length - 1))];
  });
  readonly selectedPageCount = computed(() => this.selectedPageIds().size);

  constructor() {
    // Mantener la selección coherente cuando el documento cambia (deshacer, borrar…)
    effect(() => {
      const state = this.documentStore.state();
      untracked(() => {
        const annotationIds = new Set(state.annotations.map((a) => a.id));
        if (this.selectedAnnotationId() && !annotationIds.has(this.selectedAnnotationId()!)) {
          this.selectedAnnotationId.set(null);
        }
        if (this.editingAnnotationId() && !annotationIds.has(this.editingAnnotationId()!)) {
          this.editingAnnotationId.set(null);
        }
        const pageIds = new Set(state.pages.map((p) => p.id));
        const selected = [...this.selectedPageIds()];
        if (selected.some((id) => !pageIds.has(id))) {
          this.selectedPageIds.set(new Set(selected.filter((id) => pageIds.has(id))));
        }
        if (this.currentPageIndex() >= state.pages.length) {
          this.currentPageIndex.set(Math.max(0, state.pages.length - 1));
        }
      });
    });
  }

  setTool(tool: ToolId): void {
    this.tool.set(tool);
    this.selectedAnnotationId.set(null);
    this.editingAnnotationId.set(null);
  }

  updateToolStyle(patch: Partial<ToolStyle>): void {
    this.toolStyle.update((style) => ({ ...style, ...patch }));
  }

  selectAnnotation(id: string | null): void {
    this.selectedAnnotationId.set(id);
  }

  startEditing(id: string): void {
    this.selectedAnnotationId.set(id);
    this.editingAnnotationId.set(id);
  }

  stopEditing(): void {
    this.editingAnnotationId.set(null);
  }

  setZoom(zoom: number): void {
    this.zoom.set(clamp(Math.round(zoom * 100) / 100, MIN_ZOOM, MAX_ZOOM));
  }

  /** Pasa al siguiente (o anterior) nivel de zoom predefinido. */
  stepZoom(direction: 1 | -1): void {
    const zoom = this.zoom();
    const next =
      direction > 0
        ? ZOOM_STEPS.find((s) => s > zoom + 0.001)
        : [...ZOOM_STEPS].reverse().find((s) => s < zoom - 0.001);
    if (next) this.setZoom(next);
  }

  requestScroll(pageIndex: number, y?: number): void {
    this.currentPageIndex.set(pageIndex);
    this.scrollRequest.set({ pageIndex, y, nonce: ++this.nonce });
  }

  requestFit(mode: FitMode): void {
    this.fitRequest.set({ mode, nonce: ++this.nonce });
  }

  setSelectedPages(ids: Iterable<string>): void {
    this.selectedPageIds.set(new Set(ids));
  }

  togglePageSelection(id: string): void {
    const next = new Set(this.selectedPageIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedPageIds.set(next);
  }

  clearPageSelection(): void {
    this.selectedPageIds.set(new Set());
  }

  /** Ids seleccionados en el orden del documento. */
  orderedSelectedPageIds(): string[] {
    const selected = this.selectedPageIds();
    return this.documentStore
      .pages()
      .filter((p) => selected.has(p.id))
      .map((p) => p.id);
  }

  /** Páginas sobre las que actúan los botones: la selección o, si no hay, la página actual. */
  targetPageIds(): string[] {
    const ids = this.orderedSelectedPageIds();
    if (ids.length) return ids;
    const current = this.currentPage();
    return current ? [current.id] : [];
  }

  setSearchResults(hits: readonly SearchHit[]): void {
    this.searchHits.set(hits);
    this.activeHitIndex.set(hits.length ? 0 : -1);
  }

  /** Vuelve al estado inicial al abrir o cerrar un documento. */
  reset(): void {
    this.tool.set('select');
    this.selectedAnnotationId.set(null);
    this.editingAnnotationId.set(null);
    this.selectedPageIds.set(new Set());
    this.currentPageIndex.set(0);
    this.zoom.set(1);
    this.searchHits.set([]);
    this.activeHitIndex.set(-1);
    this.initialFitDone.set(false);
  }
}
