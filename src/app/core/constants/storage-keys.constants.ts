/** Claves de localStorage (el prefijo lo añade `StorageService`). */
export const STORAGE_KEYS = {
  theme: 'theme',
  signatures: 'signatures',
  organizerThumbSize: 'organizer-thumb-size',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
