import { Injectable, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '@core/constants';
import { StorageService } from '@core/services';
import type { SignatureImage } from './signature-image';

const MAX_SAVED_SIGNATURES = 6;

/** Firmas usadas recientemente, guardadas en este navegador. */
@Injectable({ providedIn: 'root' })
export class SignatureStorageService {
  private readonly storage = inject(StorageService);
  private readonly items = signal<readonly SignatureImage[]>(
    this.storage.get(STORAGE_KEYS.signatures, []),
  );

  readonly signatures = this.items.asReadonly();

  remember(signature: SignatureImage): void {
    this.persist(
      [signature, ...this.items().filter((s) => s.src !== signature.src)].slice(
        0,
        MAX_SAVED_SIGNATURES,
      ),
    );
  }

  forget(signature: SignatureImage): void {
    this.persist(this.items().filter((s) => s !== signature));
  }

  private persist(list: readonly SignatureImage[]): void {
    this.items.set(list);
    this.storage.set(STORAGE_KEYS.signatures, list);
  }
}
