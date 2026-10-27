import { Injectable, signal } from '@angular/core';

export type DialogId =
  | 'signature'
  | 'stamp'
  | 'watermark'
  | 'numbers'
  | 'split'
  | 'meta'
  | 'shortcuts'
  | 'images'
  | 'password';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'error';
}

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly dialog = signal<DialogId | null>(null);
  readonly toasts = signal<Toast[]>([]);
  readonly theme = signal<'light' | 'dark'>(this.initialTheme());
  readonly leftOpen = signal(typeof window !== 'undefined' ? window.innerWidth > 900 : true);
  readonly rightOpen = signal(typeof window !== 'undefined' ? window.innerWidth > 1180 : true);
  readonly leftTab = signal<'pages' | 'search'>('pages');
  /** Vista principal: edición página a página u organizador en cuadrícula. */
  readonly view = signal<'edit' | 'organize'>('edit');

  /** Para el diálogo de contraseña */
  readonly passwordRequest = signal<{ file: string; incorrect: boolean; resolve: (v: string | null) => void } | null>(null);

  private seq = 0;

  toast(text: string, kind: Toast['kind'] = 'info', ms = 3600): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, text, kind }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), ms);
  }

  open(d: DialogId): void {
    this.dialog.set(d);
  }

  close(): void {
    this.dialog.set(null);
  }

  askPassword(file: string, incorrect: boolean): Promise<string | null> {
    return new Promise((resolve) => {
      this.passwordRequest.set({
        file,
        incorrect,
        resolve: (v) => {
          this.passwordRequest.set(null);
          this.dialog.set(null);
          resolve(v);
        },
      });
      this.dialog.set('password');
    });
  }

  toggleTheme(): void {
    const t = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(t);
    try {
      localStorage.setItem('gcdocs.theme', t);
    } catch {
      /* sin almacenamiento */
    }
  }

  private initialTheme(): 'light' | 'dark' {
    try {
      const saved = localStorage.getItem('gcdocs.theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* sin almacenamiento */
    }
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
