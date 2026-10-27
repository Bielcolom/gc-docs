import type { Annotation } from './annotation.model';
import type {
  DocumentMetadata,
  PageNumberSettings,
  WatermarkSettings,
} from './document-settings.model';
import type { PageRef } from './page.model';

export type FormValue = string | boolean;

/** Estado del documento sujeto a deshacer/rehacer. Siempre inmutable. */
export interface DocumentState {
  readonly pages: readonly PageRef[];
  readonly annotations: readonly Annotation[];
  /** Valores de formulario por clave `${sourceId}::${nombreDelCampo}`. */
  readonly formValues: Readonly<Record<string, FormValue>>;
  readonly watermark: WatermarkSettings;
  readonly pageNumbers: PageNumberSettings;
  readonly metadata: DocumentMetadata;
}

/** Un archivo de origen y sus páginas, en el orden en que aparecen en el documento. */
export interface DocumentGroup {
  readonly sourceId: string;
  readonly name: string;
  readonly pages: readonly PageRef[];
}
