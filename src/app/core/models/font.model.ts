export type FontId =
  | 'helvetica'
  | 'times'
  | 'courier'
  | 'roboto'
  | 'lora'
  | 'roboto-mono'
  | 'dancing'
  | 'great-vibes'
  | 'caveat';

export type FontGroup = 'classic' | 'modern' | 'handwriting';

export interface FontVariants<T> {
  readonly regular: T;
  readonly bold?: T;
  readonly italic?: T;
  readonly boldItalic?: T;
}

export interface FontDefinition {
  readonly id: FontId;
  readonly label: string;
  readonly group: FontGroup;
  /** Pila de fuentes CSS para mostrar el texto en pantalla. */
  readonly cssFamily: string;
  /** Fuente estándar de PDF (no se incrusta y solo admite caracteres de Europa occidental). */
  readonly standard?: Required<FontVariants<string>>;
  /** Archivos TTF incrustables, dentro de `/fonts`. */
  readonly files?: FontVariants<string>;
  /** Fuente incrustable equivalente para textos con caracteres fuera de WinAnsi. */
  readonly unicodeFallback?: FontId;
}

export interface FontStyle {
  readonly font: FontId;
  readonly bold: boolean;
  readonly italic: boolean;
}
