import type { FontId } from './font.model';
import type { Rect } from './geometry.model';

export type AnnotationType =
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'ink'
  | 'highlight'
  | 'image'
  | 'note'
  | 'stamp'
  | 'symbol';

interface AnnotationBase extends Rect {
  readonly id: string;
  readonly pageId: string;
  readonly type: AnnotationType;
  readonly opacity: number;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface TextCover extends Rect {
  readonly color: string;
}

export interface TextAnnotation extends AnnotationBase {
  readonly type: 'text';
  readonly text: string;
  readonly font: FontId;
  readonly size: number;
  readonly color: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly align: TextAlign;
  readonly background: string | null;
  /** Solo en ediciones de texto original: zona que tapa el texto anterior. */
  readonly cover?: TextCover;
  /** Clave de la línea original editada. */
  readonly editOf?: string;
}

export interface ShapeAnnotation extends AnnotationBase {
  readonly type: 'rect' | 'ellipse';
  readonly stroke: string | null;
  readonly fill: string | null;
  readonly strokeWidth: number;
}

export interface PathAnnotation extends AnnotationBase {
  readonly type: 'line' | 'arrow' | 'ink';
  readonly stroke: string;
  readonly strokeWidth: number;
  /** Puntos normalizados (0..1) dentro de la caja de la anotación. */
  readonly points: readonly (readonly [number, number])[];
}

export type HighlightMode = 'highlight' | 'underline' | 'strike';

export interface HighlightAnnotation extends AnnotationBase {
  readonly type: 'highlight';
  readonly color: string;
  readonly mode: HighlightMode;
}

export interface ImageAnnotation extends AnnotationBase {
  readonly type: 'image';
  /** Imagen PNG o JPEG como data URL. */
  readonly src: string;
  readonly isSignature: boolean;
}

export interface NoteAnnotation extends AnnotationBase {
  readonly type: 'note';
  readonly text: string;
  readonly color: string;
}

export interface StampAnnotation extends AnnotationBase {
  readonly type: 'stamp';
  readonly label: string;
  readonly color: string;
}

export type SymbolKind = 'check' | 'cross' | 'dot';

export interface SymbolAnnotation extends AnnotationBase {
  readonly type: 'symbol';
  readonly kind: SymbolKind;
  readonly color: string;
}

export type Annotation =
  | TextAnnotation
  | ShapeAnnotation
  | PathAnnotation
  | HighlightAnnotation
  | ImageAnnotation
  | NoteAnnotation
  | StampAnnotation
  | SymbolAnnotation;

type KeysOfUnion<T> = T extends unknown ? keyof T : never;
type ValueOfUnion<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : never
  : never;
type PatchableKey = Exclude<KeysOfUnion<Annotation>, 'id' | 'type' | 'pageId'>;

/** Cambios parciales admitidos sobre cualquier anotación (unión de sus propiedades). */
export type AnnotationPatch = { readonly [K in PatchableKey]?: ValueOfUnion<Annotation, K> };

export const isTextAnnotation = (a: Annotation | null | undefined): a is TextAnnotation =>
  a?.type === 'text';
export const isShapeAnnotation = (a: Annotation | null | undefined): a is ShapeAnnotation =>
  a?.type === 'rect' || a?.type === 'ellipse';
export const isPathAnnotation = (a: Annotation | null | undefined): a is PathAnnotation =>
  a?.type === 'line' || a?.type === 'arrow' || a?.type === 'ink';
