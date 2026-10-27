import type { PageNumberSettings } from '@core/models';

/** Nombre de archivo sin extensión. */
export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * Pasa a minúsculas y quita las tildes conservando la longitud,
 * para que los índices de una búsqueda sigan siendo válidos sobre el texto original.
 */
export function normalizeForSearch(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) {
    const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += plain.length === 1 ? plain : ch;
  }
  return out;
}

export function formatPageNumber(template: string, page: number, total: number): string {
  return template.replace(/\{n\}/g, String(page)).replace(/\{total\}/g, String(total));
}

/** Texto de la numeración de la página `index` (base 0), o `null` si no se numera. */
export function pageNumberLabel(
  settings: PageNumberSettings,
  index: number,
  total: number,
): string | null {
  if (!settings.enabled || (settings.skipFirst && index === 0)) return null;
  const offset = settings.skipFirst ? 1 : 0;
  return formatPageNumber(
    settings.format,
    index + settings.startAt - offset,
    total + settings.startAt - 1 - offset,
  );
}
