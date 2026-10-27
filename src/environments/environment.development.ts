import { type AppEnvironment } from './environment.model';

/** Configuración de desarrollo (`npm start`). */
export const environment: AppEnvironment = {
  production: false,
  appName: 'GC Docs (dev)',
  repositoryUrl: 'https://github.com/Bielcolom/gc-docs',
  storagePrefix: 'gcdocs-dev',
  logLevel: 'debug',
};
