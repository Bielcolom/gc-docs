import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { STAMPS, currentPageRef, placeStamp } from '../core/actions';
import { splitToZip } from '../core/export-tools';
import { NumberPosition } from '../core/models';
import { parseRanges } from '../core/util';
import { Icon } from './icon';
import { PageActions } from './page-actions';
import { SignaturePad } from './signature-pad';
import { Swatches } from './swatches';
import { UiService } from './ui.service';
import { PALETTE } from '../core/actions';

@Component({
  selector: 'app-dialogs',
  imports: [Icon, SignaturePad, Swatches],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialogs.html',
  styleUrl: './dialogs.css',
  host: { '(document:keydown.escape)': 'onEsc()' },
})
export class Dialogs {
  protected readonly ui = inject(UiService);
  protected readonly store = inject(DocumentStore);
  protected readonly actions = inject(PageActions);

  protected readonly Math = Math;
  protected readonly STAMPS = STAMPS;
  protected readonly PALETTE = PALETTE;
  protected readonly positions: { id: NumberPosition; label: string }[] = [
    { id: 'top-left', label: 'Arriba a la izquierda' },
    { id: 'top-center', label: 'Arriba en el centro' },
    { id: 'top-right', label: 'Arriba a la derecha' },
    { id: 'bottom-left', label: 'Abajo a la izquierda' },
    { id: 'bottom-center', label: 'Abajo en el centro' },
    { id: 'bottom-right', label: 'Abajo a la derecha' },
  ];
  protected readonly formats = ['{n}', '{n} / {total}', 'Página {n}', 'Página {n} de {total}', '— {n} —'];

  protected readonly titles: Record<string, string> = {
    signature: 'Firma',
    stamp: 'Sellos',
    watermark: 'Marca de agua',
    numbers: 'Numerar páginas',
    split: 'Dividir el documento',
    meta: 'Propiedades del documento',
    shortcuts: 'Atajos de teclado',
    images: 'Guardar como imágenes',
    password: 'PDF protegido',
  };

  // Sello personalizado
  protected readonly customStamp = signal('');
  protected readonly customColor = signal('#1d3a8a');

  // Dividir
  protected readonly splitMode = signal<'every' | 'ranges' | 'single'>('every');
  protected readonly splitEvery = signal(1);
  protected readonly splitRanges = signal('');
  protected readonly splitGroups = computed(() => {
    const total = this.store.pages().length;
    const mode = this.splitMode();
    if (mode === 'ranges') return parseRanges(this.splitRanges(), total);
    const n = mode === 'single' ? 1 : Math.max(1, Math.floor(this.splitEvery()));
    const groups: number[][] = [];
    for (let i = 0; i < total; i += n) groups.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k));
    return groups;
  });

  // Imágenes
  protected readonly dpi = signal(150);

  // Contraseña
  protected readonly password = signal('');

  constructor() {
    effect(() => {
      if (this.ui.dialog() === 'split' && !this.splitRanges()) {
        const n = this.store.pages().length;
        this.splitRanges.set(n > 1 ? `1-${Math.ceil(n / 2)}, ${Math.ceil(n / 2) + 1}-${n}` : '1');
      }
      if (this.ui.dialog() === 'password') this.password.set('');
    });
  }

  protected onEsc(): void {
    if (this.ui.dialog() === 'password') this.cancelPassword();
    else if (this.ui.dialog()) this.ui.close();
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.onEsc();
  }

  protected stamp(label: string, color: string): void {
    const page = currentPageRef(this.store);
    if (!page || !label.trim()) return;
    placeStamp(this.store, page, label.trim().toUpperCase(), color);
    this.ui.close();
  }

  protected wm<K extends keyof ReturnType<DocumentStore['state']>['watermark']>(key: K, value: ReturnType<DocumentStore['state']>['watermark'][K]): void {
    const wm = this.store.state().watermark;
    this.store.patchSettings({ watermark: { ...wm, [key]: value } }, `wm:${String(key)}`);
  }

  protected pn<K extends keyof ReturnType<DocumentStore['state']>['pageNumbers']>(key: K, value: ReturnType<DocumentStore['state']>['pageNumbers'][K]): void {
    const pn = this.store.state().pageNumbers;
    this.store.patchSettings({ pageNumbers: { ...pn, [key]: value } }, `pn:${String(key)}`);
  }

  protected meta(key: 'title' | 'author' | 'subject' | 'keywords', value: string): void {
    const m = this.store.state().meta;
    this.store.patchSettings({ meta: { ...m, [key]: value } }, `meta:${key}`);
  }

  protected async doSplit(): Promise<void> {
    const groups = this.splitGroups();
    if (!groups?.length) return;
    this.ui.close();
    await this.actions.run('Dividiendo el documento…', () => splitToZip(this.store, groups));
    this.ui.toast(`${groups.length} archivos descargados en un ZIP`, 'ok');
  }

  protected async doImages(): Promise<void> {
    this.ui.close();
    await this.actions.exportPng(this.dpi());
  }

  protected submitPassword(): void {
    this.ui.passwordRequest()?.resolve(this.password());
  }

  protected cancelPassword(): void {
    this.ui.passwordRequest()?.resolve(null);
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  protected num(e: Event): number {
    return parseFloat((e.target as HTMLInputElement).value);
  }
  protected checked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
  protected stop(e: KeyboardEvent): void {
    if (e.key !== 'Escape') e.stopPropagation();
  }
}
