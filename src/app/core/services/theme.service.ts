import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '@core/constants';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);
  private readonly current = signal<Theme>(this.initialTheme());

  readonly theme = this.current.asReadonly();

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.current();
    });
  }

  toggle(): void {
    const next: Theme = this.current() === 'dark' ? 'light' : 'dark';
    this.current.set(next);
    this.storage.set(STORAGE_KEYS.theme, next);
  }

  private initialTheme(): Theme {
    const saved = this.storage.get<Theme | null>(STORAGE_KEYS.theme, null);
    if (saved === 'light' || saved === 'dark') return saved;
    return this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
}
