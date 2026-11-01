import type { Rect } from '@core/models';

/**
 * Modelo intermedio de la conversión PDF → DOCX. Todo va en puntos y en el espacio base de la
 * página (origen arriba a la izquierda). Separa la lectura del PDF (`pdf-page-reader`) de la
 * maquetación (`layout`) y de la escritura del archivo (`docx-writer`), así cada paso se puede
 * probar sin los demás.
 */

/** Trozo de texto con un único formato. */
export interface StyledRun {
  readonly text: string;
  readonly fontSize: number;
  /** Familia tipográfica disponible en Google Docs (p. ej. "Arial"). */
  readonly font: string;
  readonly bold: boolean;
  readonly italic: boolean;
  /** Color en hexadecimal sin `#` (p. ej. "000000"). */
  readonly color: string;
  /**
   * Número de página o total de páginas: se escribe como campo, que Google Docs mantiene al día.
   * `text` guarda el número que se veía en el PDF.
   */
  readonly field?: 'page' | 'pages';
}

export interface StyledLine extends Rect {
  readonly baseline: number;
  readonly fontSize: number;
  readonly runs: readonly StyledRun[];
}

export interface PageImage extends Rect {
  /** PNG ya recortado de la página. */
  readonly data: Uint8Array;
}

export interface PageContent {
  readonly width: number;
  readonly height: number;
  readonly lines: readonly StyledLine[];
  readonly images: readonly PageImage[];
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/** Separa dos celdas de una fila (texto alineado en columnas con tabuladores). */
export interface TabRun {
  readonly tab: true;
}

export type ParagraphRun = StyledRun | TabRun;

export interface ParagraphBlock {
  readonly kind: 'paragraph';
  readonly runs: readonly ParagraphRun[];
  readonly align: TextAlign;
  /** Sangría izquierda respecto al margen. */
  readonly indent: number;
  /** Sangría extra de la primera línea (negativa si es francesa, como en las viñetas). */
  readonly firstLineIndent: number;
  readonly spaceBefore: number;
  /** Interlineado como múltiplo del sencillo (1 = sencillo). */
  readonly lineSpacing: number;
  /** Posiciones de tabulación respecto al margen. */
  readonly tabStops: readonly number[];
  /** 0 = texto normal; 1–3 = Título 1–3. */
  readonly heading: 0 | 1 | 2 | 3;
  /** Tamaño de letra mayoritario (sirve para detectar títulos). */
  readonly fontSize: number;
}

export interface ImageBlock {
  readonly kind: 'image';
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly indent: number;
  readonly spaceBefore: number;
}

export type Block = ParagraphBlock | ImageBlock;

export interface Margins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  /** Distancia del borde superior a la cabecera y del inferior al pie. */
  readonly header: number;
  readonly footer: number;
}

/** El documento listo para escribir: Google Docs solo admite un tamaño de página por documento. */
export interface DocumentLayout {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly margins: Margins;
  /** Bloques de cada página del PDF, en orden de lectura. */
  readonly pages: readonly (readonly Block[])[];
  /** Cabecera y pie que se repiten en las páginas (vacíos si no hay). */
  readonly header: readonly Block[];
  readonly footer: readonly Block[];
  /** La primera página no lleva cabecera ni pie (una portada). */
  readonly titlePage: boolean;
  /** Número de la primera página, si la numeración del PDF no empieza en 1. */
  readonly firstPageNumber: number;
}
