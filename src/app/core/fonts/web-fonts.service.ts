import { DOCUMENT, Injectable, inject } from '@angular/core';
import { APP_BASE_URL } from '@core/tokens/app-base-url.token';
import { FONTS, primaryFamily } from './font-catalog';

/** Registra las fuentes incrustables como @font-face para que el texto en pantalla coincida con el PDF. */
@Injectable({ providedIn: 'root' })
export class WebFontsService {
  private readonly document = inject(DOCUMENT);
  private readonly baseUrl = inject(APP_BASE_URL);
  private registered = false;

  register(): void {
    if (this.registered) return;
    this.registered = true;
    const rules: string[] = [];
    for (const font of FONTS) {
      if (!font.files) continue;
      const family = primaryFamily(font);
      const variants: [string | undefined, number, string][] = [
        [font.files.regular, 400, 'normal'],
        [font.files.bold, 700, 'normal'],
        [font.files.italic, 400, 'italic'],
        [font.files.boldItalic, 700, 'italic'],
      ];
      for (const [file, weight, style] of variants) {
        if (!file) continue;
        rules.push(
          `@font-face{font-family:"${family}";src:url("${this.baseUrl}fonts/${file}") format("truetype");` +
            `font-weight:${weight};font-style:${style};font-display:swap;}`,
        );
      }
    }
    const style = this.document.createElement('style');
    style.textContent = rules.join('\n');
    this.document.head.appendChild(style);
  }
}
