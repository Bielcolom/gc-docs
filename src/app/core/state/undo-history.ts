import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

export interface UndoHistoryOptions {
  /** Número máximo de pasos guardados. */
  readonly limit: number;
  /** Ventana (ms) en la que cambios con la misma clave se agrupan en un solo paso. */
  readonly coalesceMs: number;
  /** Reloj inyectable para los tests. */
  readonly now?: () => number;
}

/**
 * Historial de deshacer/rehacer para un estado inmutable.
 *
 * - `set()` guarda el estado anterior como un paso nuevo.
 * - Los cambios con la misma `coalesceKey` en poco tiempo (p. ej. escribir en un campo) cuentan como uno.
 * - `begin()`/`end()` agrupan una operación larga (p. ej. arrastrar) en un único paso.
 */
export class UndoHistory<T> {
  private readonly current: WritableSignal<T>;
  private readonly past = signal<readonly T[]>([]);
  private readonly future = signal<readonly T[]>([]);
  private lastCoalesce: { key: string; at: number } | null = null;
  private transactionStart: T | null = null;
  private readonly now: () => number;

  readonly state: Signal<T>;
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  constructor(
    initial: T,
    private readonly options: UndoHistoryOptions,
  ) {
    this.current = signal<T>(initial);
    this.state = this.current.asReadonly();
    this.now = options.now ?? Date.now;
  }

  get inTransaction(): boolean {
    return this.transactionStart !== null;
  }

  /** Aplica un estado nuevo. Devuelve `false` si no cambia nada. */
  set(next: T, coalesceKey?: string): boolean {
    const previous = this.current();
    if (next === previous) return false;
    if (!this.inTransaction) {
      const at = this.now();
      const coalesce =
        coalesceKey !== undefined &&
        this.lastCoalesce?.key === coalesceKey &&
        at - this.lastCoalesce.at < this.options.coalesceMs;
      if (!coalesce) this.pushPast(previous);
      this.future.set([]);
      this.lastCoalesce = coalesceKey === undefined ? null : { key: coalesceKey, at };
    }
    this.current.set(next);
    return true;
  }

  /** Cambia el estado sin crear un paso en el historial (ajustes automáticos, no del usuario). */
  replace(next: T): void {
    this.current.set(next);
  }

  begin(): void {
    this.transactionStart ??= this.current();
  }

  end(): void {
    const start = this.transactionStart;
    this.transactionStart = null;
    if (start === null || start === this.current()) return;
    this.pushPast(start);
    this.future.set([]);
    this.lastCoalesce = null;
  }

  undo(): boolean {
    this.end();
    const past = this.past();
    if (!past.length) return false;
    this.future.update((f) => [...f, this.current()]);
    this.current.set(past[past.length - 1]);
    this.past.set(past.slice(0, -1));
    this.lastCoalesce = null;
    return true;
  }

  redo(): boolean {
    const future = this.future();
    if (!future.length) return false;
    this.pushPast(this.current());
    this.current.set(future[future.length - 1]);
    this.future.set(future.slice(0, -1));
    this.lastCoalesce = null;
    return true;
  }

  /** Empieza de cero con un estado nuevo, sin historial. */
  reset(state: T): void {
    this.transactionStart = null;
    this.lastCoalesce = null;
    this.past.set([]);
    this.future.set([]);
    this.current.set(state);
  }

  private pushPast(state: T): void {
    this.past.update((p) => [...p, state].slice(-this.options.limit));
  }
}
