import type { ConverterDefinition, FileFormatId } from '@core/models';

/**
 * Conversores disponibles. Para añadir uno:
 *  1. Declara el formato en `FileFormatId` y `FILE_FORMATS` si es nuevo.
 *  2. Crea un servicio que implemente `Converter` en `core/convert/<origen>-to-<destino>/`.
 *  3. Añade aquí su definición. La interfaz lo muestra sola, en los dos sentidos del selector.
 *
 * `load()` usa `import()` para que el código y sus librerías solo se descarguen al convertir.
 */
export const CONVERTERS: readonly ConverterDefinition[] = [
  {
    id: 'pdf-to-docx',
    from: 'pdf',
    to: 'docx',
    description:
      'Conserva el texto, los títulos, la negrita y la cursiva, los colores y las imágenes, ' +
      'listo para abrirlo en Google Docs.',
    load: () => import('./pdf-to-docx/pdf-to-docx.converter').then((m) => m.PdfToDocxConverter),
  },
];

export function findConverter(
  from: FileFormatId,
  to: FileFormatId,
  converters: readonly ConverterDefinition[] = CONVERTERS,
): ConverterDefinition | null {
  return converters.find((c) => c.from === from && c.to === to) ?? null;
}

/** Formatos a los que se puede convertir `from`. */
export function targetsOf(
  from: FileFormatId,
  converters: readonly ConverterDefinition[] = CONVERTERS,
): FileFormatId[] {
  return converters.filter((c) => c.from === from).map((c) => c.to);
}

/** Formatos desde los que se puede llegar a `to`. */
export function sourcesOf(
  to: FileFormatId,
  converters: readonly ConverterDefinition[] = CONVERTERS,
): FileFormatId[] {
  return converters.filter((c) => c.to === to).map((c) => c.from);
}
