import type { Matrix, Rotation } from './geometry.model';

/** Un archivo PDF cargado: abierto por el usuario o generado (páginas en blanco, imágenes…). */
export interface SourceInfo {
  readonly id: string;
  readonly name: string;
  readonly pageCount: number;
  /** El PDF está cifrado: pdf-lib no puede reescribirlo y sus páginas se exportan como imagen. */
  readonly encrypted: boolean;
}

/**
 * Una página del documento final.
 *
 * Todas las coordenadas de la aplicación se expresan en el "espacio base" de la página:
 * la vista de pdf.js a escala 1 con la rotación propia del PDF ya aplicada, en puntos y con
 * el origen arriba a la izquierda. La rotación del usuario se aplica por encima.
 */
export interface PageRef {
  readonly id: string;
  readonly sourceId: string;
  /** Índice (base 0) de la página dentro de su archivo de origen. */
  readonly sourceIndex: number;
  /** Rotación añadida por el usuario. */
  readonly rotation: Rotation;
  /** Ancho en el espacio base. */
  readonly width: number;
  /** Alto en el espacio base. */
  readonly height: number;
  /** Transformación de pdf.js del espacio PDF al espacio base. */
  readonly viewportTransform: Matrix;
}
