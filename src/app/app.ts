import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { DocumentStore } from './core/document.store';
import { registerWebFonts } from './core/fonts';
import { baseHref } from './core/pdfjs';
import { currentPageRef, placeImage } from './core/actions';
import { clamp, normalizeImage } from './core/util';
import { ToolId } from './core/models';
import { Dialogs } from './ui/dialogs';
import { Icon } from './ui/icon';
import { Inspector } from './ui/inspector';
import { PageActions } from './ui/page-actions';
import { Sidebar } from './ui/sidebar';
import { ToolRail } from './ui/tool-rail';
import { UiService } from './ui/ui.service';
import { Viewer, ZOOM_STEPS } from './ui/viewer';
import { Welcome } from './ui/welcome';
import { Organizer } from './ui/organizer';

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  e: 'editText',
  t: 'text',
  h: 'highlight',
  d: 'ink',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  w: 'whiteout',
  n: 'note',
};

@Component({
  selector: 'app-root',
  imports: [Welcome, Viewer, Sidebar, ToolRail, Inspector, Dialogs, Icon, Organizer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:paste)': 'onPaste($event)',
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '(document:dragover)': '$event.preventDefault()',
    '(document:drop)': '$event.preventDefault()',
  },
})
export class App {
  protected readonly store = inject(DocumentStore);
  protected readonly ui = inject(UiService);
  protected readonly actions = inject(PageActions);

  protected readonly zoomLabel = computed(() => `${Math.round(this.store.zoom() * 100)} %`);

  constructor() {
    registerWebFonts(baseHref());
    this.store.passwordPrompt = (file, incorrect) => this.ui.askPassword(file, incorrect);
    effect(() => {
      document.documentElement.dataset['theme'] = this.ui.theme();
    });
    // Al volver del organizador, recolocar el visor en la página actual
    let lastView = this.ui.view();
    effect(() => {
      const v = this.ui.view();
      if (v === 'edit' && lastView === 'organize') untracked(() => setTimeout(() => this.store.requestScroll(this.store.currentPage()), 0));
      if (v === 'organize') untracked(() => this.store.selectedId.set(null));
      lastView = v;
    });
    // Cierra la transacción de una edición de texto aunque el cuadro desaparezca sin perder el foco
    effect(() => {
      if (!this.store.editingId()) untracked(() => this.store.end());
    });
    effect(() => {
      const name = this.store.fileName();
      document.title = this.store.hasDocument() ? `${name} · GC Docs` : 'GC Docs · Editor de PDF';
    });
  }

  protected setName(e: Event): void {
    const v = (e.target as HTMLInputElement).value.trim().replace(/\.pdf$/i, '');
    this.store.fileName.set(v || 'documento');
  }

  protected zoomStep(dir: 1 | -1): void {
    const z = this.store.zoom();
    const next = dir > 0 ? ZOOM_STEPS.find((s) => s > z + 0.001) : [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001);
    this.store.zoom.set(next ?? z);
  }

  protected fit(mode: 'width' | 'page'): void {
    this.store.fitRequest.set({ mode, nonce: Math.random() });
  }

  protected close(): void {
    if (this.store.dirty() && !confirm('¿Cerrar el documento? Los cambios que no hayas descargado se perderán.')) return;
    this.store.closeDocument();
  }

  // ---------------------------------------------------------------------------
  // Teclado
  // ---------------------------------------------------------------------------

  protected onKey(e: KeyboardEvent): void {
    if (!this.store.hasDocument() || this.ui.dialog()) return;
    const target = e.target as HTMLElement;
    const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const sel = this.store.selectedAnnot();

    if (mod) {
      if (key === 's') {
        e.preventDefault();
        this.actions.download();
        return;
      }
      if (key === 'o') {
        e.preventDefault();
        this.actions.open();
        return;
      }
      if (key === 'p') {
        e.preventDefault();
        this.actions.print();
        return;
      }
      if (key === 'f') {
        e.preventDefault();
        this.ui.leftOpen.set(true);
        this.ui.leftTab.set('search');
        return;
      }
      if (key === '=' || key === '+') {
        e.preventDefault();
        this.zoomStep(1);
        return;
      }
      if (key === '-') {
        e.preventDefault();
        this.zoomStep(-1);
        return;
      }
      if (key === '0') {
        e.preventDefault();
        this.fit('width');
        return;
      }
      if (typing) return;
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.store.redo();
        else this.store.undo();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        this.store.redo();
        return;
      }
      if (key === 'd' && sel) {
        e.preventDefault();
        this.store.duplicateAnnot(sel.id);
        return;
      }
      if (sel?.type === 'text' && (key === 'b' || key === 'i' || key === 'u')) {
        e.preventDefault();
        const prop = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline';
        this.store.updateAnnot(sel.id, { [prop]: !(sel as any)[prop] } as any);
      }
      return;
    }
    if (typing) return;
    // El organizador gestiona sus propias teclas
    if (this.ui.view() === 'organize') return;
    if (key === 'g' && !e.altKey) {
      this.ui.view.set('organize');
      return;
    }
    // Mientras se abre un cuadro de texto, las teclas no deben cambiar de herramienta
    if (this.store.editingId() && key !== 'escape') return;

    if (key === 'escape') {
      this.store.editingId.set(null);
      if (this.store.selectedId()) this.store.selectedId.set(null);
      else if (this.store.tool() !== 'select') this.store.tool.set('select');
      else this.store.selectedPages.set(new Set());
      return;
    }
    if ((key === 'delete' || key === 'backspace') && sel) {
      e.preventDefault();
      this.store.removeAnnot(sel.id);
      return;
    }
    if (key === 'enter' && sel && (sel.type === 'text' || sel.type === 'note')) {
      e.preventDefault();
      this.store.editingId.set(sel.id);
      return;
    }
    if (sel && key.startsWith('arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      this.store.updateAnnot(sel.id, { x: sel.x + dx, y: sel.y + dy }, `nudge:${sel.id}`);
      return;
    }
    if (key === 'pagedown' || key === 'pageup' || (!sel && (key === 'arrowright' || key === 'arrowleft'))) {
      e.preventDefault();
      const dir = key === 'pagedown' || key === 'arrowright' ? 1 : -1;
      const idx = clamp(this.store.currentPage() + dir, 0, this.store.pages().length - 1);
      this.store.requestScroll(idx);
      return;
    }
    if (e.altKey) return;
    if (TOOL_KEYS[key]) {
      this.store.tool.set(TOOL_KEYS[key]);
      this.store.selectedId.set(null);
      return;
    }
    if (key === 'i') this.actions.addImage();
    else if (key === 's') this.ui.open('signature');
    else if (key === '?') this.ui.open('shortcuts');
  }

  protected async onPaste(e: ClipboardEvent): Promise<void> {
    const target = e.target as HTMLElement;
    if (!this.store.hasDocument() || target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    const file = item?.getAsFile();
    const page = currentPageRef(this.store);
    if (!file || !page) return;
    e.preventDefault();
    const img = await normalizeImage(file);
    placeImage(this.store, page, img.src, img.width * 0.75, img.height * 0.75);
    this.ui.toast('Imagen pegada en la página', 'ok');
  }

  protected onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.store.dirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
}
