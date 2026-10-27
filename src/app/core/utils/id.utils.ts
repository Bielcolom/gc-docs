let counter = 0;

/** Identificador único legible, p. ej. `pg_lx3k2a9f`. */
export function createId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${time}${counter.toString(36)}${random}`;
}
