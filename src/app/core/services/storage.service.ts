import { Injectable, inject } from '@angular/core';
import type { StorageKey } from '@core/constants';
import { ENVIRONMENT } from '@core/tokens/environment.token';

/**
 * Envoltorio de localStorage que nunca lanza errores: el almacenamiento puede no existir
 * (modo privado, cookies bloqueadas) o estar lleno.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = inject(ENVIRONMENT).storagePrefix;

  get<T>(key: StorageKey, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.fullKey(key));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set<T>(key: StorageKey, value: T): boolean {
    try {
      localStorage.setItem(this.fullKey(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: StorageKey): void {
    try {
      localStorage.removeItem(this.fullKey(key));
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  private fullKey(key: StorageKey): string {
    return `${this.prefix}.${key}`;
  }
}
