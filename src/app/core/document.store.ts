import { Injectable, computed, signal } from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import {
  Annot,
  DEFAULT_PAGE_NUMBERS,
  DEFAULT_WATERMARK,
  DocState,
  EMPTY_META,
  PageRef,
  Rotation,
  SourceInfo,
  ToolId,
  ToolStyle,
} from './models';
import { PDFDocumentProxy, PDFPageProxy, PasswordRequiredError, openPdf, pageGeometry } from './pdfjs';
import { baseName, normalizeImage, readFileBytes, uid } from './util';

interface LoadedSource {
  info: SourceInfo;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  password?: string;
  pages: Map<number, Promise<PDFPageProxy>>;
}

const EMPTY_STATE: DocState = {
  pages: [],
  annots: [],
  forms: {},
  watermark: DEFAULT_WATERMARK,
  pageNumbers: DEFAULT_PAGE_NUMBERS,
  meta: EMPTY_META,
};

const HISTORY_LIMIT = 120;

export type PasswordPrompt = (fileName: string, incorrect: boolean) => Promise<string | null>;

@Injectable({ providedIn: 'root' })
export class DocumentStore {
  private sources = new Map<string, LoadedSource>();

  readonly state = signal<DocState>(EMPTY_STATE);
  readonly fileName = signal('documento');
  readonly busy = signal<string | null>(null);

  private past: DocState[] = [];
  private future: DocState[] = [];
  private lastCoalesce: { key: string; at: number } | null = null;
  private txStart: DocState | null = null;
  readonly historyVersion = signal(0);
  readonly canUndo = computed(() => (this.historyVersion(), this.past.length > 0));
  readonly canRedo = computed(() => (this.historyVersion(), this.future.length > 0));
  readonly dirty = signal(false);

  // ---- UI / sesión ----
  readonly tool = signal<ToolId>('select');
  readonly style = signal<ToolStyle>({
    color: '#1d3a8a',
    fill: null,
    strokeWidth: 2,
    opacity: 1,
    font: 'helvetica',
    size: 14,
    bold: false,
    italic: false,
    highlightColor: '#ffe14d',
    highlightMode: 'highlight',
    symbol: 'check',
    noteColor: '#f5c518',
  });
  readonly selectedId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly selectedPages = signal<Set<string>>(new Set());
  readonly zoom = signal(1);
  readonly currentPage = signal(0);
  /** Petición de desplazamiento del visor a una página (índice). */
  readonly scrollRequest = signal<{ index: number; y?: number; nonce: number } | null>(null);
  readonly fitRequest = signal<{ mode: 'width' | 'page'; nonce: number } | null>(null);
  readonly searchHits = signal<{ pageId: string; x: number; y: number; w: number; h: number }[]>([]);
  readonly activeHit = signal(-1);

  passwordPrompt: PasswordPrompt = async () => null;

  readonly pages = computed(() => this.state().pages);
  readonly annots = computed(() => this.state().annots);
  readonly hasDocument = computed(() => this.state().pages.length > 0);
  readonly selectedAnnot = computed(() => {
    const id = this.selectedId();
    return id ? (this.state().annots.find((a) => a.id === id) ?? null) : null;
  });
  readonly annotsByPage = computed(() => {
    const map = new Map<string, Annot[]>();
    for (const a of this.state().annots) {
      const list = map.get(a.pageId);
      if (list) list.push(a);
      else map.set(a.pageId, [a]);
    }
    return map;
  });

  // ---------------------------------------------------------------------------
  // Fuentes y páginas
  // ---------------------------------------------------------------------------

  source(srcId: string): LoadedSource | undefined {
    return this.sources.get(srcId);
  }

  sourceList(): LoadedSource[] {
    return [...this.sources.values()];
  }

  getPdfPage(srcId: string, index: number): Promise<PDFPageProxy> {
    const src = this.sources.get(srcId);
    if (!src) return Promise.reject(new Error('Fuente no encontrada'));
    let p = src.pages.get(index);
    if (!p) {
      p = src.pdf.getPage(index + 1);
      src.pages.set(index, p);
    }
    return p;
  }

  private async registerSource(bytes: Uint8Array, name: string): Promise<{ src: LoadedSource; pages: PageRef[] } | null> {
    let password: string | undefined;
    let pdf: PDFDocumentProxy | null = null;
    let incorrect = false;
    for (;;) {
      try {
        pdf = await openPdf(bytes, password);
        break;
      } catch (e) {
        if (e instanceof PasswordRequiredError) {
          const pw = await this.passwordPrompt(name, incorrect || e.incorrect);
          if (pw === null) return null;
          password = pw;
          incorrect = true;
          continue;
        }
        throw e;
      }
    }
    let encrypted = !!password;
    if (!encrypted) {
      try {
        await PDFDocument.load(bytes, { updateMetadata: false });
      } catch (e: any) {
        encrypted = /encrypt/i.test(String(e?.message ?? e));
      }
    }
    const info: SourceInfo = { id: uid('src'), name, pageCount: pdf.numPages, encrypted };
    const src: LoadedSource = { info, bytes, pdf, password, pages: new Map() };
    this.sources.set(info.id, src);
    const pages: PageRef[] = [];
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await this.getPdfPage(info.id, i);
      const g = pageGeometry(page);
      pages.push({ id: uid('pg'), srcId: info.id, srcIndex: i, rotation: 0, w: g.w, h: g.h, vt: g.vt });
    }
    return { src, pages };
  }

  /** Abre archivos (PDF o imágenes). Si `at` es undefined, sustituye al documento actual si está vacío o los añade al final. */
  async addFiles(files: File[], at?: number): Promise<number> {
    const startEmpty = !this.hasDocument();
    let inserted: PageRef[] = [];
    this.busy.set(files.length > 1 ? `Abriendo ${files.length} archivos…` : `Abriendo ${files[0]?.name ?? ''}…`);
    try {
      const images: File[] = [];
      for (const file of files) {
        if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)) {
          images.push(file);
          continue;
        }
        const bytes = await readFileBytes(file);
        const res = await this.registerSource(bytes, file.name);
        if (res) inserted = inserted.concat(res.pages);
      }
      if (images.length) {
        const bytes = await imagesToPdf(images);
        const res = await this.registerSource(bytes, images.length === 1 ? images[0].name : 'imágenes');
        if (res) inserted = inserted.concat(res.pages);
      }
    } finally {
      this.busy.set(null);
    }
    if (!inserted.length) return 0;
    if (startEmpty) {
      const first = files[0];
      this.fileName.set(baseName(first.name));
      this.past = [];
      this.future = [];
      this.state.set({ ...EMPTY_STATE, pages: inserted });
      this.historyVersion.update((v) => v + 1);
      this.dirty.set(false);
      this.zoom.set(1);
      this.currentPage.set(0);
    } else {
      const pages = [...this.state().pages];
      const index = at === undefined ? pages.length : at;
      pages.splice(index, 0, ...inserted);
      this.commit({ ...this.state(), pages });
      this.requestScroll(index);
    }
    return inserted.length;
  }

  async newBlankDocument(): Promise<void> {
    const bytes = await blankPdf(1);
    const res = await this.registerSource(bytes, 'en blanco');
    if (!res) return;
    this.fileName.set('documento nuevo');
    this.past = [];
    this.future = [];
    this.state.set({ ...EMPTY_STATE, pages: res.pages });
    this.historyVersion.update((v) => v + 1);
    this.dirty.set(false);
  }

  async insertBlankPage(at: number, size?: { w: number; h: number }): Promise<void> {
    const ref = this.state().pages[Math.max(0, at - 1)];
    const w = size?.w ?? (ref ? (ref.rotation % 180 ? ref.h : ref.w) : 595.28);
    const h = size?.h ?? (ref ? (ref.rotation % 180 ? ref.w : ref.h) : 841.89);
    const bytes = await blankPdf(1, w, h);
    const res = await this.registerSource(bytes, 'página en blanco');
    if (!res) return;
    const pages = [...this.state().pages];
    pages.splice(at, 0, ...res.pages);
    this.commit({ ...this.state(), pages });
    this.requestScroll(at);
  }

  closeDocument(): void {
    for (const s of this.sources.values()) s.pdf.loadingTask.destroy();
    this.sources.clear();
    this.past = [];
    this.future = [];
    this.state.set(EMPTY_STATE);
    this.historyVersion.update((v) => v + 1);
    this.selectedId.set(null);
    this.editingId.set(null);
    this.selectedPages.set(new Set());
    this.searchHits.set([]);
    this.tool.set('select');
    this.dirty.set(false);
  }

  // ---------------------------------------------------------------------------
  // Historial
  // ---------------------------------------------------------------------------

  /** Aplica un nuevo estado guardando el anterior en el historial. */
  commit(next: DocState, coalesceKey?: string): void {
    const prev = this.state();
    if (next === prev) return;
    if (!this.txStart) {
      const now = Date.now();
      const coalesce = coalesceKey && this.lastCoalesce?.key === coalesceKey && now - this.lastCoalesce.at < 1200;
      if (!coalesce) {
        this.past.push(prev);
        if (this.past.length > HISTORY_LIMIT) this.past.shift();
      }
      this.future = [];
      this.lastCoalesce = coalesceKey ? { key: coalesceKey, at: now } : null;
      this.historyVersion.update((v) => v + 1);
    }
    this.state.set(next);
    this.dirty.set(true);
  }

  /** Inicia una transacción (p.ej. arrastrar): los cambios intermedios no generan historial. */
  begin(): void {
    if (this.txStart) return;
    this.txStart = this.state();
  }

  end(): void {
    const start = this.txStart;
    this.txStart = null;
    if (!start || start === this.state()) return;
    this.past.push(start);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.lastCoalesce = null;
    this.historyVersion.update((v) => v + 1);
  }

  undo(): void {
    if (this.txStart) this.end();
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.state());
    this.state.set(prev);
    this.lastCoalesce = null;
    this.historyVersion.update((v) => v + 1);
    this.fixSelection();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.state());
    this.state.set(next);
    this.lastCoalesce = null;
    this.historyVersion.update((v) => v + 1);
    this.fixSelection();
  }

  private fixSelection(): void {
    const id = this.selectedId();
    if (id && !this.state().annots.some((a) => a.id === id)) this.selectedId.set(null);
    this.editingId.set(null);
    const ids = new Set(this.state().pages.map((p) => p.id));
    const sel = new Set([...this.selectedPages()].filter((p) => ids.has(p)));
    this.selectedPages.set(sel);
  }

  // ---------------------------------------------------------------------------
  // Anotaciones
  // ---------------------------------------------------------------------------

  addAnnot(a: Annot, select = true): void {
    this.commit({ ...this.state(), annots: [...this.state().annots, a] });
    if (select) this.selectedId.set(a.id);
  }

  updateAnnot(id: string, patch: Partial<Annot>, coalesceKey?: string): void {
    const s = this.state();
    let changed = false;
    const annots = s.annots.map((a) => {
      if (a.id !== id) return a;
      changed = true;
      return { ...a, ...patch } as Annot;
    });
    if (changed) this.commit({ ...s, annots }, coalesceKey);
  }

  removeAnnot(id: string): void {
    const s = this.state();
    this.commit({ ...s, annots: s.annots.filter((a) => a.id !== id) });
    if (this.selectedId() === id) this.selectedId.set(null);
    if (this.editingId() === id) this.editingId.set(null);
  }

  duplicateAnnot(id: string): void {
    const a = this.state().annots.find((x) => x.id === id);
    if (!a) return;
    const copy = { ...a, id: uid('an'), x: a.x + 12, y: a.y + 12 } as Annot;
    if (copy.type === 'text') {
      delete copy.cover;
      delete copy.editOf;
    }
    this.addAnnot(copy);
  }

  bringToFront(id: string, front: boolean): void {
    const s = this.state();
    const a = s.annots.find((x) => x.id === id);
    if (!a) return;
    const rest = s.annots.filter((x) => x.id !== id);
    this.commit({ ...s, annots: front ? [...rest, a] : [a, ...rest] });
  }

  // ---------------------------------------------------------------------------
  // Operaciones de página
  // ---------------------------------------------------------------------------

  rotatePages(ids: string[], delta: 90 | -90): void {
    const set = new Set(ids);
    const s = this.state();
    this.commit({
      ...s,
      pages: s.pages.map((p) => (set.has(p.id) ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 as Rotation } : p)),
    });
  }

  deletePages(ids: string[]): void {
    const set = new Set(ids);
    const s = this.state();
    const pages = s.pages.filter((p) => !set.has(p.id));
    if (!pages.length) return;
    this.commit({ ...s, pages, annots: s.annots.filter((a) => !set.has(a.pageId)) });
    this.selectedPages.set(new Set());
    this.currentPage.set(Math.min(this.currentPage(), pages.length - 1));
  }

  duplicatePages(ids: string[]): void {
    const set = new Set(ids);
    const s = this.state();
    const pages: PageRef[] = [];
    const annots = [...s.annots];
    for (const p of s.pages) {
      pages.push(p);
      if (set.has(p.id)) {
        const copy = { ...p, id: uid('pg') };
        pages.push(copy);
        for (const a of s.annots) if (a.pageId === p.id) annots.push({ ...a, id: uid('an'), pageId: copy.id } as Annot);
      }
    }
    this.commit({ ...s, pages, annots });
  }

  /** Mueve las páginas indicadas para que queden antes de la página que ahora está en `toIndex`. */
  movePages(ids: string[], toIndex: number): void {
    const set = new Set(ids);
    const s = this.state();
    const moving = s.pages.filter((p) => set.has(p.id));
    const before = s.pages.slice(0, toIndex).filter((p) => !set.has(p.id));
    const after = s.pages.slice(toIndex).filter((p) => !set.has(p.id));
    const pages = [...before, ...moving, ...after];
    if (pages.every((p, i) => p === s.pages[i])) return;
    this.commit({ ...s, pages });
  }

  /** Coloca las páginas indicadas para que la primera quede en la posición final `index` (base 0). */
  placePages(ids: string[], index: number): void {
    const set = new Set(ids);
    const s = this.state();
    const moving = s.pages.filter((p) => set.has(p.id));
    const rest = s.pages.filter((p) => !set.has(p.id));
    const at = Math.max(0, Math.min(index, rest.length));
    const pages = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
    if (pages.every((p, i) => p === s.pages[i])) return;
    this.commit({ ...s, pages });
  }

  /** Desplaza las páginas seleccionadas una posición hacia delante o hacia atrás. */
  shiftPages(ids: string[], dir: -1 | 1): void {
    const set = new Set(ids);
    const pages = [...this.state().pages];
    const idx = pages.map((p, i) => (set.has(p.id) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return;
    if (dir < 0 && idx[0] === 0) return;
    if (dir > 0 && idx[idx.length - 1] === pages.length - 1) return;
    const order = dir < 0 ? idx : [...idx].reverse();
    for (const i of order) [pages[i], pages[i + dir]] = [pages[i + dir], pages[i]];
    this.commit({ ...this.state(), pages });
  }

  reversePages(): void {
    const s = this.state();
    this.commit({ ...s, pages: [...s.pages].reverse() });
  }

  /** Documentos de origen en el orden en que aparecen sus páginas. */
  readonly documents = computed(() => {
    const groups = new Map<string, { srcId: string; name: string; pages: PageRef[]; first: number }>();
    this.state().pages.forEach((p, i) => {
      let g = groups.get(p.srcId);
      if (!g) {
        g = { srcId: p.srcId, name: this.sourceName(p.srcId), pages: [], first: i };
        groups.set(p.srcId, g);
      }
      g.pages.push(p);
    });
    return [...groups.values()];
  });

  sourceName(srcId: string): string {
    const name = this.sources.get(srcId)?.info.name ?? 'documento';
    return name.replace(/\.pdf$/i, '');
  }

  /** Reordena documentos completos. Las páginas de cada documento quedan juntas, en su orden actual. */
  reorderDocuments(srcOrder: string[]): void {
    const s = this.state();
    const bySrc = new Map<string, PageRef[]>();
    for (const p of s.pages) {
      const l = bySrc.get(p.srcId) ?? [];
      l.push(p);
      bySrc.set(p.srcId, l);
    }
    const pages = srcOrder.flatMap((id) => bySrc.get(id) ?? []);
    for (const [id, l] of bySrc) if (!srcOrder.includes(id)) pages.push(...l);
    if (pages.every((p, i) => p === s.pages[i])) return;
    this.commit({ ...s, pages });
  }

  sortDocuments(dir: 'asc' | 'desc'): void {
    const docs = [...this.documents()];
    const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
    docs.sort((a, b) => collator.compare(a.name, b.name) * (dir === 'asc' ? 1 : -1));
    this.reorderDocuments(docs.map((d) => d.srcId));
  }

  setFormValue(srcId: string, field: string, value: string | boolean): void {
    const s = this.state();
    const key = `${srcId}::${field}`;
    this.commit({ ...s, forms: { ...s.forms, [key]: value } }, `form:${key}`);
  }

  patchSettings(patch: Partial<Pick<DocState, 'watermark' | 'pageNumbers' | 'meta'>>, coalesceKey?: string): void {
    this.commit({ ...this.state(), ...patch }, coalesceKey);
  }

  requestScroll(index: number, y?: number): void {
    this.scrollRequest.set({ index, y, nonce: Math.random() });
  }

  pageIndex(pageId: string): number {
    return this.state().pages.findIndex((p) => p.id === pageId);
  }
}

// -----------------------------------------------------------------------------

async function blankPdf(count: number, w = 595.28, h = 841.89): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) doc.addPage([w, h]);
  return doc.save();
}

export async function imagesToPdf(files: Blob[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const f of files) {
    const img = await normalizeImage(f);
    const bytes = Uint8Array.from(atob(img.src.split(',')[1]), (c) => c.charCodeAt(0));
    const embedded = img.src.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    // 96 ppp -> puntos, limitado a un tamaño razonable
    let w = (img.width * 72) / 96;
    let h = (img.height * 72) / 96;
    const max = 1190;
    const k = Math.min(1, max / Math.max(w, h));
    w *= k;
    h *= k;
    const page = doc.addPage([w, h]);
    page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
  }
  return doc.save();
}
