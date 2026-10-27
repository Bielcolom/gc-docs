import { type AppEnvironment } from './environment.model';

/** Configuración de producción (la que se publica en GitHub Pages). */
export const environment: AppEnvironment = {
  production: true,
  appName: 'GC Docs',
  repositoryUrl: 'https://github.com/Bielcolom/gc-docs',
  storagePrefix: 'gcdocs',
  logLevel: 'warn',
};
