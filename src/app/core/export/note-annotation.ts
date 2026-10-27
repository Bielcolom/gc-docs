import type { Matrix, NoteAnnotation } from '@core/models';
import { applyMatrix, hexToRgb01 } from '@core/utils';
import { PDFHexString, PDFString, type PDFDocument, type PDFPage } from 'pdf-lib';

/**
 * Añade un comentario como anotación PDF de tipo "Text" (la nota amarilla estándar),
 * visible y editable en cualquier lector.
 * @param toPdf Matriz del espacio base con Y hacia arriba al espacio PDF.
 */
export function addNoteAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  note: NoteAnnotation,
  toPdf: Matrix,
  height: number,
  author: string,
): void {
  const corners = [
    { x: note.x, y: height - note.y },
    { x: note.x + note.w, y: height - note.y },
    { x: note.x, y: height - note.y - note.h },
    { x: note.x + note.w, y: height - note.y - note.h },
  ].map((p) => applyMatrix(toPdf, p));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const annotation = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    Contents: PDFHexString.fromText(note.text),
    T: PDFHexString.fromText(author),
    Name: 'Comment',
    C: [...hexToRgb01(note.color)],
    F: 4,
    Open: false,
    M: PDFString.fromDate(new Date()),
    CA: note.opacity,
  });
  page.node.addAnnot(doc.context.register(annotation));
}
