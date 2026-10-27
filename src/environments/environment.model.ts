export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppEnvironment {
  readonly production: boolean;
  readonly appName: string;
  readonly repositoryUrl: string;
  /** Prefijo de las claves guardadas en localStorage. */
  readonly storagePrefix: string;
  readonly logLevel: LogLevel;
}
