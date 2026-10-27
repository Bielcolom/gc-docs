/** Segmentos de URL de la aplicación. Se definen una sola vez y se usan en las rutas y en el código. */
export const ROUTE_SEGMENTS = {
  workspace: 'documento',
  editor: 'editar',
  organizer: 'organizar',
} as const;

/** Destinos de navegación, listos para `router.navigate()` o `routerLink`. */
export const APP_PATHS = {
  welcome: ['/'],
  editor: ['/', ROUTE_SEGMENTS.workspace, ROUTE_SEGMENTS.editor],
  organizer: ['/', ROUTE_SEGMENTS.workspace, ROUTE_SEGMENTS.organizer],
} as const;
