/**
 * Interpreta rangos de páginas escritos por el usuario, p. ej. `"1-3, 5, 8-"`.
 * Devuelve grupos de índices en base 0, o `null` si el texto no es válido.
 */
export function parsePageRanges(input: string, total: number): number[][] | null {
  const groups: number[][] = [];
  for (const part of input.split(/[,;]+/)) {
    const token = part.trim();
    if (!token) continue;
    const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(token);
    if (!match || (!match[1] && !match[3])) return null;
    const from = match[1] ? parseInt(match[1], 10) : 1;
    const to = match[2] ? (match[3] ? parseInt(match[3], 10) : total) : from;
    if (from < 1 || to < 1 || from > total || to > total) return null;
    const group: number[] = [];
    const step = from <= to ? 1 : -1;
    for (let i = from; step > 0 ? i <= to : i >= to; i += step) group.push(i - 1);
    groups.push(group);
  }
  return groups.length ? groups : null;
}

/** Divide `total` páginas en grupos consecutivos de `size`. */
export function chunkPages(total: number, size: number): number[][] {
  const n = Math.max(1, Math.floor(size));
  const groups: number[][] = [];
  for (let i = 0; i < total; i += n) {
    groups.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k));
  }
  return groups;
}
