export interface WatermarkSettings {
  readonly enabled: boolean;
  readonly text: string;
  readonly size: number;
  readonly color: string;
  readonly opacity: number;
  readonly angle: number;
}

export type PageNumberPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface PageNumberSettings {
  readonly enabled: boolean;
  /** Plantilla con `{n}` (número) y `{total}`. */
  readonly format: string;
  readonly position: PageNumberPosition;
  readonly size: number;
  readonly color: string;
  readonly startAt: number;
  readonly skipFirst: boolean;
}

export interface DocumentMetadata {
  readonly title: string;
  readonly author: string;
  readonly subject: string;
  readonly keywords: string;
}
