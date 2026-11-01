/** Segmentos de URL de la aplicación. Se definen una sola vez y se usan en las rutas y en el código. */
export const ROUTE_SEGMENTS = {
  workspace: 'documento',
  editor: 'editar',
  organizer: 'organizar',
  converter: 'convertir',
} as const;

/** Destinos de navegación, listos para `router.navigate()` o `routerLink`. */
export const APP_PATHS = {
  welcome: ['/'],
  editor: ['/', ROUTE_SEGMENTS.workspace, ROUTE_SEGMENTS.editor],
  organizer: ['/', ROUTE_SEGMENTS.workspace, ROUTE_SEGMENTS.organizer],
  converter: ['/', ROUTE_SEGMENTS.converter],
} as const;

/**
 * Parámetros de `/convertir` con el sentido de la conversión (p. ej. `?de=pdf&a=docx`).
 * La pantalla los recibe como `input()` con estos mismos nombres.
 */
export function converterQuery(pair: { readonly from: string; readonly to: string }): {
  de: string;
  a: string;
} {
  return { de: pair.from, a: pair.to };
}
