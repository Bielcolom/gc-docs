import type { Type } from '@angular/core';

/** Formatos de archivo que conoce el conversor. Añadir uno nuevo empieza aquí. */
export type FileFormatId = 'pdf' | 'docx';

export interface FileFormat {
  readonly id: FileFormatId;
  /** Nombre que ve el usuario (p. ej. "Google Docs"). */
  readonly label: string;
  /** Aclaración corta bajo el nombre (p. ej. "Archivo .docx"). */
  readonly hint: string;
  /** Extensión principal, con punto, que llevan los archivos generados. */
  readonly extension: string;
  readonly extensions: readonly string[];
  readonly mimeTypes: readonly string[];
}

/** Sentido de una conversión: de un formato a otro. */
export interface ConversionPair {
  readonly from: FileFormatId;
  readonly to: FileFormatId;
}

export interface ConversionProgress {
  /** Pasos terminados y total (p. ej. páginas). */
  readonly done: number;
  readonly total: number;
}

export interface ConversionOptions {
  readonly onProgress?: (progress: ConversionProgress) => void;
  readonly signal?: AbortSignal;
}

export interface ConversionResult {
  readonly blob: Blob;
  readonly fileName: string;
  /** Avisos para el usuario: lo que no se ha podido conservar. */
  readonly warnings: readonly string[];
}

/**
 * Contrato que cumple cada conversor. Se implementa como servicio `providedIn: 'root'` para poder
 * inyectarle dependencias (pdf.js, avisos…).
 */
export interface Converter {
  convert(file: File, options?: ConversionOptions): Promise<ConversionResult>;
}

export interface ConverterDefinition extends ConversionPair {
  readonly id: string;
  /** Qué conserva y qué no, en una frase. */
  readonly description: string;
  /** Carga bajo demanda el código del conversor (y sus librerías). */
  readonly load: () => Promise<Type<Converter>>;
}
