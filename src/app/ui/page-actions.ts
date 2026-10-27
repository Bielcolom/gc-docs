import { Injectable, inject } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { currentPageRef, placeImage } from '../core/actions';
import { downloadPdf, exportImages, printPdf } from '../core/export-tools';
import { normalizeImage } from '../core/util';
import { UiService } from './ui.service';

/** Acciones de alto nivel compartidas por la barra superior, el panel lateral y los atajos. */
@Injectable({ providedIn: 'root' })
export class PageActions {
  private readonly store = inject(DocumentStore);
  private readonly ui = inject(UiService);

  pickFiles(accept: string, multiple = true): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      input.onchange = () => resolve([...(input.files ?? [])]);
      input.addEventListener('cancel', () => resolve([]));
      input.click();
    });
  }

  async open(): Promise<void> {
    const files = await this.pickFiles('application/pdf,.pdf,image/*');
    if (!files.length) return;
    if (this.store.hasDocument()) {
      if (this.store.dirty() && !confirm('¿Abrir otro documento? Se perderán los cambios que no hayas descargado.')) return;
      this.store.closeDocument();
    }
    await this.safe(() => this.store.addFiles(files));
  }

  /** Añadir PDFs o imágenes como páginas nuevas. */
  async insertFiles(at?: number): Promise<void> {
    const files = await this.pickFiles('application/pdf,.pdf,image/*');
    if (!files.length) return;
    const pos = at ?? this.store.currentPage() + 1;
    const n = await this.safe(() => this.store.addFiles(files, pos));
    if (n) this.ui.toast(`${n} ${n === 1 ? 'página añadida' : 'páginas añadidas'}`, 'ok');
  }

  async insertBlank(at?: number): Promise<void> {
    await this.store.insertBlankPage(at ?? this.store.currentPage() + 1);
    this.ui.toast('Página en blanco añadida', 'ok');
  }

  /** Inserta una imagen como elemento sobre la página actual. */
  async addImage(): Promise<void> {
    const [file] = await this.pickFiles('image/*', false);
    const page = currentPageRef(this.store);
    if (!file || !page) return;
    const img = await normalizeImage(file);
    placeImage(this.store, page, img.src, img.width * 0.75, img.height * 0.75);
  }

  targetPages(): string[] {
    const sel = this.store.selectedPages();
    if (sel.size) return this.store.pages().filter((p) => sel.has(p.id)).map((p) => p.id);
    const cur = currentPageRef(this.store);
    return cur ? [cur.id] : [];
  }

  rotate(delta: 90 | -90): void {
    this.store.rotatePages(this.targetPages(), delta);
  }

  rotateAll(delta: 90 | -90): void {
    this.store.rotatePages(this.store.pages().map((p) => p.id), delta);
  }

  deleteTarget(): void {
    const ids = this.targetPages();
    if (ids.length >= this.store.pages().length) {
      this.ui.toast('No puedes eliminar todas las páginas', 'error');
      return;
    }
    this.store.deletePages(ids);
    this.ui.toast(ids.length === 1 ? 'Página eliminada' : `${ids.length} páginas eliminadas`, 'info');
  }

  duplicateTarget(): void {
    this.store.duplicatePages(this.targetPages());
  }

  async extractTarget(): Promise<void> {
    const ids = this.targetPages();
    await this.run('Extrayendo páginas…', () => downloadPdf(this.store, ids, `_paginas`));
  }

  async download(): Promise<void> {
    const rasterized = await this.run('Preparando el PDF…', () => downloadPdf(this.store));
    if (rasterized === undefined) return;
    this.store.dirty.set(false);
    this.ui.toast(rasterized ? 'PDF descargado. Las páginas protegidas se han guardado como imagen.' : 'PDF descargado', 'ok');
  }

  async print(): Promise<void> {
    await this.run('Preparando la impresión…', () => printPdf(this.store));
  }

  async exportPng(dpi: number): Promise<void> {
    await this.run('Generando imágenes…', () => exportImages(this.store, dpi));
    this.ui.toast('Imágenes descargadas', 'ok');
  }

  async run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    this.store.busy.set(label);
    try {
      return await fn();
    } catch (e: any) {
      console.error(e);
      this.ui.toast(`No se pudo completar: ${e?.message ?? e}`, 'error', 6000);
      return undefined;
    } finally {
      this.store.busy.set(null);
    }
  }

  private async safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (e: any) {
      console.error(e);
      this.ui.toast(`No se pudo abrir el archivo: ${e?.message ?? e}`, 'error', 6000);
      return undefined;
    }
  }
}
