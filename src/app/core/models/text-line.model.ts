/** Fragmento de una línea que procede de un único elemento de texto de pdf.js. */
export interface TextSegment {
  /** Índices de inicio y fin dentro de `TextLine.text`. */
  readonly start: number;
  readonly end: number;
  readonly x: number;
  readonly width: number;
}

/** Una línea de texto del PDF, en el espacio base de la página. */
export interface TextLine {
  readonly key: string;
  readonly text: string;
  readonly x: number;
  /** Parte superior de la caja. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
  readonly fontSize: number;
  readonly fontName: string;
  /** Nombre real de la fuente (p. ej. "ABCDEF+Arial-BoldMT") si se conoce. */
  readonly fontRealName: string;
  readonly fontFamily: string;
  readonly segments: readonly TextSegment[];
}

/** Elemento de texto tal y como sale de pdf.js, ya pasado al espacio base. */
export interface RawTextItem {
  readonly text: string;
  readonly x: number;
  readonly baseline: number;
  readonly width: number;
  readonly fontSize: number;
  readonly fontName: string;
  readonly fontRealName: string;
  readonly fontFamily: string;
  readonly ascent: number;
  readonly descent: number;
}

export interface SearchHit {
  readonly pageId: string;
  readonly pageIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly before: string;
  readonly match: string;
  readonly after: string;
}
