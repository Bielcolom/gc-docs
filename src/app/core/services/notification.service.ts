import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'info' | 'success' | 'error';

export interface AppNotification {
  readonly id: number;
  readonly message: string;
  readonly kind: NotificationKind;
}

const DURATION_MS: Readonly<Record<NotificationKind, number>> = {
  info: 3600,
  success: 3600,
  error: 6000,
};

/** Avisos breves (toasts) en la parte inferior de la pantalla. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly items = signal<readonly AppNotification[]>([]);
  private nextId = 0;

  readonly notifications = this.items.asReadonly();

  info(message: string): void {
    this.show(message, 'info');
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((n) => n.id !== id));
  }

  private show(message: string, kind: NotificationKind): void {
    const id = ++this.nextId;
    this.items.update((list) => [...list, { id, message, kind }]);
    setTimeout(() => this.dismiss(id), DURATION_MS[kind]);
  }
}
