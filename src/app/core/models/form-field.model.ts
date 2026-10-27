import type { FormValue } from './document-state.model';
import type { Rect } from './geometry.model';

export type FormFieldKind = 'text' | 'checkbox' | 'radio' | 'select';

export interface FormFieldOption {
  readonly value: string;
  readonly label: string;
}

/** Campo de formulario de un PDF, en el espacio base de su página. */
export interface FormField extends Rect {
  readonly id: string;
  readonly name: string;
  readonly kind: FormFieldKind;
  readonly multiline: boolean;
  readonly readOnly: boolean;
  readonly initialValue: FormValue;
  /** Valor que representa este botón (casillas y botones de opción). */
  readonly exportValue: string;
  readonly options: readonly FormFieldOption[];
  readonly fontSize: number;
}
