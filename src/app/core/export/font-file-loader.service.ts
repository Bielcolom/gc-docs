import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_BASE_URL } from '@core/tokens/app-base-url.token';
import { firstValueFrom, shareReplay, type Observable } from 'rxjs';

/** Descarga (una sola vez) los archivos TTF que se incrustan en los PDF. */
@Injectable({ providedIn: 'root' })
export class FontFileLoaderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_BASE_URL);
  private readonly cache = new Map<string, Observable<ArrayBuffer>>();

  load(fileName: string): Promise<ArrayBuffer> {
    let request = this.cache.get(fileName);
    if (!request) {
      request = this.http
        .get(`${this.baseUrl}fonts/${fileName}`, { responseType: 'arraybuffer' })
        .pipe(shareReplay(1));
      this.cache.set(fileName, request);
    }
    return firstValueFrom(request);
  }
}
