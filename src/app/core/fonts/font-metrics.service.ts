import { DOCUMENT, Injectable, inject } from '@angular/core';
import type { FontId } from '@core/models';
import { getFont, primaryFamily } from './font-catalog';

/** Alto de línea de los textos, en proporción del tamaño de letra. */
export const LINE_HEIGHT = 1.2;

interface Metrics {
  readonly ascent: number;
  readonly descent: number;
}

/**
 * Mide las fuentes tal y como las dibuja el navegador, para colocar el texto
 * en el PDF exactamente donde se ve en pantalla.
 */
@Injectable({ providedIn: 'root' })
export class FontMetricsService {
  private readonly document = inject(DOCUMENT);
  private readonly cache = new Map<string, Metrics>();
  private context?: CanvasRenderingContext2D | null;

  metrics(font: FontId, bold: boolean, italic: boolean): Metrics {
    const key = `${font}|${bold}|${italic}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const definition = getFont(font);
    const ctx = this.getContext();
    if (!ctx) return { ascent: 0.9, descent: 0.22 };
    ctx.font = `${italic ? 'italic ' : ''}${bold ? 700 : 400} 100px ${definition.cssFamily}`;
    const m = ctx.measureText('Hgjy');
    const result: Metrics = {
      ascent: (m.fontBoundingBoxAscent ?? 90) / 100,
      descent: (m.fontBoundingBoxDescent ?? 22) / 100,
    };
    // Solo se guarda cuando la fuente ya está cargada; si no, serían las métricas de la fuente de reserva
    if (!definition.files || this.document.fonts.check(`100px "${primaryFamily(definition)}"`)) {
      this.cache.set(key, result);
    }
    return result;
  }

  /** Distancia desde la parte superior de una línea de texto hasta su línea base. */
  baselineOffset(font: FontId, bold: boolean, italic: boolean, size: number): number {
    const { ascent, descent } = this.metrics(font, bold, italic);
    return (size * LINE_HEIGHT - (ascent + descent) * size) / 2 + ascent * size;
  }

  /** Ancho de un texto con una fuente CSS cualquiera. */
  measure(text: string, cssFamily: string, size: number, bold = false): number {
    const ctx = this.getContext();
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${bold ? 700 : 400} ${size}px ${cssFamily}`;
    return ctx.measureText(text).width;
  }

  private getContext(): CanvasRenderingContext2D | null {
    this.context ??= this.document.createElement('canvas').getContext('2d');
    return this.context;
  }
}
