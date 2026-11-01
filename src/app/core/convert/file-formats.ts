import type { FileFormat, FileFormatId } from '@core/models';
import { baseName } from '@core/utils';

/** Catálogo de formatos, en el orden en que aparecen en los selectores. */
export const FILE_FORMATS: Readonly<Record<FileFormatId, FileFormat>> = {
  pdf: {
    id: 'pdf',
    label: 'PDF',
    hint: 'Documento PDF',
    extension: '.pdf',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
  },
  docx: {
    id: 'docx',
    label: 'Google Docs',
    hint: 'Archivo .docx',
    extension: '.docx',
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
};

export const FORMAT_IDS = Object.keys(FILE_FORMATS) as FileFormatId[];

export function isFormatId(value: unknown): value is FileFormatId {
  return typeof value === 'string' && value in FILE_FORMATS;
}

/** Formato de un archivo por su extensión o, si no la tiene, por su tipo MIME. */
export function detectFormat(file: Pick<File, 'name' | 'type'>): FileFormatId | null {
  const name = file.name.toLowerCase();
  const byExtension = FORMAT_IDS.find((id) =>
    FILE_FORMATS[id].extensions.some((ext) => name.endsWith(ext)),
  );
  return (
    byExtension ?? FORMAT_IDS.find((id) => FILE_FORMATS[id].mimeTypes.includes(file.type)) ?? null
  );
}

/** Valor del atributo `accept` de un `<input type="file">` para un formato. */
export function acceptFor(format: FileFormatId): string {
  const { extensions, mimeTypes } = FILE_FORMATS[format];
  return [...mimeTypes, ...extensions].join(',');
}

/** Nombre del archivo convertido: el original con la extensión del formato de destino. */
export function convertedFileName(sourceName: string, to: FileFormatId): string {
  return `${baseName(sourceName) || 'documento'}${FILE_FORMATS[to].extension}`;
}
