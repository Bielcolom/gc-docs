/**
 * Datos de prueba compartidos por los tests unitarios.
 * Crear los objetos con funciones (y no con constantes) evita que un test modifique los de otro.
 */
import { EMPTY_DOCUMENT } from '@core/constants';
import type { DocumentState, PageRef, ShapeAnnotation, TextAnnotation } from '@core/models';

export function makePage(id: string, overrides: Partial<PageRef> = {}): PageRef {
  return {
    id,
    sourceId: 'src-a',
    sourceIndex: 0,
    rotation: 0,
    width: 600,
    height: 800,
    viewportTransform: [1, 0, 0, -1, 0, 800],
    ...overrides,
  };
}

/** Páginas `p1..pN` del mismo archivo. */
export function makePages(count: number, sourceId = 'src-a'): PageRef[] {
  return Array.from({ length: count }, (_, i) =>
    makePage(`p${i + 1}`, { sourceId, sourceIndex: i }),
  );
}

export function makeState(overrides: Partial<DocumentState> = {}): DocumentState {
  return { ...EMPTY_DOCUMENT, pages: makePages(3), ...overrides };
}

export function makeRect(id: string, pageId = 'p1'): ShapeAnnotation {
  return {
    id,
    pageId,
    type: 'rect',
    x: 10,
    y: 20,
    w: 100,
    h: 50,
    opacity: 1,
    stroke: '#000000',
    fill: null,
    strokeWidth: 2,
  };
}

export function makeText(id: string, pageId = 'p1'): TextAnnotation {
  return {
    id,
    pageId,
    type: 'text',
    x: 0,
    y: 0,
    w: 80,
    h: 14,
    opacity: 1,
    text: 'Hola',
    font: 'helvetica',
    size: 12,
    color: '#000000',
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    background: null,
  };
}

/** Identificadores predecibles para operaciones que crean objetos nuevos. */
export function sequentialIds(): (prefix: string) => string {
  let n = 0;
  return (prefix) => `${prefix}-${++n}`;
}

export const pageIds = (state: DocumentState): string[] => state.pages.map((p) => p.id);
