import type { Routes } from '@angular/router';
import { ROUTE_SEGMENTS } from '@core/constants';
import { documentLoadedGuard } from '@core/guards';

/**
 * Rutas de la aplicación. Cada pantalla se carga bajo demanda (lazy loading)
 * para que la página de inicio sea ligera.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'GC Docs · Editor de PDF',
    loadComponent: () =>
      import('@features/welcome/welcome-page/welcome-page.component').then(
        (m) => m.WelcomePageComponent,
      ),
  },
  {
    path: ROUTE_SEGMENTS.workspace,
    canActivate: [documentLoadedGuard],
    loadComponent: () =>
      import('@layout/workspace-layout/workspace-layout.component').then(
        (m) => m.WorkspaceLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: ROUTE_SEGMENTS.editor },
      {
        path: ROUTE_SEGMENTS.editor,
        title: 'Editar · GC Docs',
        loadComponent: () =>
          import('@features/editor/editor-page/editor-page.component').then(
            (m) => m.EditorPageComponent,
          ),
      },
      {
        path: ROUTE_SEGMENTS.organizer,
        title: 'Organizar · GC Docs',
        loadComponent: () =>
          import('@features/organizer/organizer-page/organizer-page.component').then(
            (m) => m.OrganizerPageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
