import type {
  DocumentMetadata,
  DocumentState,
  PageNumberSettings,
  WatermarkSettings,
} from '@core/models';

/** Tamaño A4 en puntos. */
export const A4 = { width: 595.28, height: 841.89 } as const;

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  text: 'CONFIDENCIAL',
  size: 64,
  color: '#c2412d',
  opacity: 0.18,
  angle: 45,
};

export const DEFAULT_PAGE_NUMBERS: PageNumberSettings = {
  enabled: false,
  format: '{n} / {total}',
  position: 'bottom-center',
  size: 10,
  color: '#4a4f55',
  startAt: 1,
  skipFirst: false,
};

export const EMPTY_METADATA: DocumentMetadata = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
};

export const EMPTY_DOCUMENT: DocumentState = {
  pages: [],
  annotations: [],
  formValues: {},
  watermark: DEFAULT_WATERMARK,
  pageNumbers: DEFAULT_PAGE_NUMBERS,
  metadata: EMPTY_METADATA,
};

/** Número máximo de pasos que se pueden deshacer. */
export const HISTORY_LIMIT = 120;
/** Tiempo durante el que cambios seguidos del mismo tipo cuentan como un solo paso. */
export const HISTORY_COALESCE_MS = 1200;

/** Margen de la numeración de páginas, en puntos. */
export const PAGE_NUMBER_MARGIN = 28;
