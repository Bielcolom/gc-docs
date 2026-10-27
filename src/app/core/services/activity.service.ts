import { Injectable, computed, signal } from '@angular/core';

/** Indicador de "trabajando…" para operaciones largas (abrir, exportar, dividir…). */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly labels = signal<readonly string[]>([]);

  readonly busyLabel = computed(() => this.labels().at(-1) ?? null);
  readonly isBusy = computed(() => this.labels().length > 0);

  async run<T>(label: string, task: () => Promise<T>): Promise<T> {
    this.labels.update((l) => [...l, label]);
    try {
      return await task();
    } finally {
      this.labels.update((l) => {
        const i = l.lastIndexOf(label);
        return i < 0 ? l : [...l.slice(0, i), ...l.slice(i + 1)];
      });
    }
  }
}
