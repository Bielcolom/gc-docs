import { clamp } from './math.utils';

export type Rgb = readonly [number, number, number];

/** `#rrggbb` o `#rgb` → componentes entre 0 y 1. */
export function hexToRgb01(hex: string): Rgb {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Componentes entre 0 y 255 → `#rrggbb`. */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
  );
}

/** Distancia Manhattan entre dos colores en 0..255. */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}
