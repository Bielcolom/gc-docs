import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY_DOCUMENT, HISTORY_COALESCE_MS, HISTORY_LIMIT } from '@core/constants';
import type {
  Annotation,
  AnnotationPatch,
  DocumentGroup,
  DocumentMetadata,
  DocumentState,
  FormValue,
  PageNumberSettings,
  PageRef,
  WatermarkSettings,
} from '@core/models';
import { SourceRegistryService } from '@core/pdf';
import { createId } from '@core/utils';
import * as ops from './document.operations';
import { UndoHistory } from './undo-history';

/**
 * Estado del documento que se está editando: páginas, anotaciones, formularios y ajustes.
 *
 * Es la única fuente de verdad. Los componentes leen sus `signals` y llaman a sus métodos;
 * la lógica de cada cambio vive en `document.operations.ts` (funciones puras).
 */
@Injectable({ providedIn: 'root' })
export class DocumentStore {
  private readonly sources = inject(SourceRegistryService);
  private readonly history = new UndoHistory<DocumentState>(EMPTY_DOCUMENT, {
    limit: HISTORY_LIMIT,
    coalesceMs: HISTORY_COALESCE_MS,
  });
  private readonly unsaved = signal(false);
  private readonly name = signal('documento');

  // --- Selectores ---------------------------------------------------------
  readonly state = this.history.state;
  readonly pages = computed(() => this.state().pages);
  readonly annotations = computed(() => this.state().annotations);
  readonly formValues = computed(() => this.state().formValues);
  readonly watermark = computed(() => this.state().watermark);
  readonly pageNumbers = computed(() => this.state().pageNumbers);
  readonly metadata = computed(() => this.state().metadata);
  readonly pageCount = computed(() => this.pages().length);
  readonly hasDocument = computed(() => this.pageCount() > 0);
  readonly canUndo = this.history.canUndo;
  readonly canRedo = this.history.canRedo;
  readonly hasUnsavedChanges = this.unsaved.asReadonly();
  readonly fileName = this.name.asReadonly();

  readonly annotationsByPage = computed(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of this.annotations()) {
      const list = map.get(a.pageId);
      if (list) list.push(a);
      else map.set(a.pageId, [a]);
    }
    return map;
  });

  readonly sourceGroups = computed<DocumentGroup[]>(() => {
    this.sources.changes();
    return ops.groupBySource(this.pages(), (id) => this.sources.displayName(id));
  });

  // --- Ciclo de vida --------------------------------------------------------

  /** Empieza un documento nuevo con estas páginas. */
  load(pages: readonly PageRef[], fileName: string): void {
    this.history.reset({ ...EMPTY_DOCUMENT, pages });
    this.name.set(fileName || 'documento');
    this.unsaved.set(false);
  }

  close(): void {
    this.history.reset(EMPTY_DOCUMENT);
    this.unsaved.set(false);
  }

  rename(fileName: string): void {
    this.name.set(fileName.trim().replace(/\.pdf$/i, '') || 'documento');
  }

  markSaved(): void {
    this.unsaved.set(false);
  }

  // --- Historial ------------------------------------------------------------

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  /** Agrupa los cambios siguientes en un único paso de deshacer. */
  beginTransaction(): void {
    this.history.begin();
  }

  endTransaction(): void {
    this.history.end();
  }

  // --- Páginas --------------------------------------------------------------

  insertPages(pages: readonly PageRef[], at?: number): void {
    this.apply(ops.insertPages(this.state(), pages, at));
  }

  rotatePages(ids: readonly string[], delta: 90 | -90): void {
    this.apply(ops.rotatePages(this.state(), ids, delta));
  }

  deletePages(ids: readonly string[]): void {
    this.apply(ops.deletePages(this.state(), ids));
  }

  duplicatePages(ids: readonly string[]): void {
    this.apply(ops.duplicatePages(this.state(), ids, createId));
  }

  movePages(ids: readonly string[], toIndex: number): void {
    this.apply(ops.movePages(this.state(), ids, toIndex));
  }

  placePages(ids: readonly string[], index: number): void {
    this.apply(ops.placePages(this.state(), ids, index));
  }

  shiftPages(ids: readonly string[], direction: -1 | 1): void {
    this.apply(ops.shiftPages(this.state(), ids, direction));
  }

  reversePages(): void {
    this.apply(ops.reversePages(this.state()));
  }

  reorderSources(order: readonly string[]): void {
    this.apply(ops.reorderSources(this.state(), order));
  }

  sortSourcesByName(direction: 'asc' | 'desc'): void {
    this.apply(
      ops.sortSourcesByName(this.state(), (id) => this.sources.displayName(id), direction),
    );
  }

  pageIndex(pageId: string): number {
    return this.pages().findIndex((p) => p.id === pageId);
  }

  // --- Anotaciones ------------------------------------------------------------

  addAnnotation(annotation: Annotation): void {
    this.apply(ops.addAnnotation(this.state(), annotation));
  }

  updateAnnotation(id: string, patch: AnnotationPatch, coalesceKey?: string): void {
    this.apply(ops.updateAnnotation(this.state(), id, patch), coalesceKey);
  }

  /** Ajusta medidas calculadas al pintar (no es un cambio del usuario: no crea paso de deshacer). */
  syncAnnotationSizes(patches: ReadonlyMap<string, AnnotationPatch>): void {
    this.history.replace(ops.patchAnnotations(this.state(), patches));
  }

  removeAnnotation(id: string): void {
    this.apply(ops.removeAnnotation(this.state(), id));
  }

  /** Duplica una anotación y devuelve el id de la copia. */
  duplicateAnnotation(id: string, offset: number): string {
    const copyId = createId('an');
    this.apply(ops.duplicateAnnotation(this.state(), id, copyId, offset));
    return copyId;
  }

  moveAnnotationInStack(id: string, to: 'front' | 'back'): void {
    this.apply(ops.moveAnnotationInStack(this.state(), id, to));
  }

  findAnnotation(id: string | null): Annotation | null {
    return id ? (this.annotations().find((a) => a.id === id) ?? null) : null;
  }

  // --- Formularios y ajustes -------------------------------------------------

  formValue(sourceId: string, fieldName: string): FormValue | undefined {
    return this.formValues()[ops.formValueKey(sourceId, fieldName)];
  }

  setFormValue(sourceId: string, fieldName: string, value: FormValue): void {
    const key = ops.formValueKey(sourceId, fieldName);
    this.apply(ops.setFormValue(this.state(), key, value), `form:${key}`);
  }

  updateWatermark(patch: Partial<WatermarkSettings>): void {
    this.apply(
      { ...this.state(), watermark: { ...this.watermark(), ...patch } },
      `watermark:${Object.keys(patch)}`,
    );
  }

  updatePageNumbers(patch: Partial<PageNumberSettings>): void {
    this.apply(
      { ...this.state(), pageNumbers: { ...this.pageNumbers(), ...patch } },
      `numbers:${Object.keys(patch)}`,
    );
  }

  updateMetadata(patch: Partial<DocumentMetadata>): void {
    this.apply(
      { ...this.state(), metadata: { ...this.metadata(), ...patch } },
      `metadata:${Object.keys(patch)}`,
    );
  }

  private apply(next: DocumentState, coalesceKey?: string): void {
    if (this.history.set(next, coalesceKey)) this.unsaved.set(true);
  }
}
