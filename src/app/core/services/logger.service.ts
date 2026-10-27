import { Injectable, inject } from '@angular/core';
import type { LogLevel } from '@env/environment.model';
import { ENVIRONMENT } from '@core/tokens/environment.token';

const LEVELS: Readonly<Record<LogLevel, number>> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Punto único de registro de mensajes: en producción solo salen advertencias y errores. */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly minLevel = LEVELS[inject(ENVIRONMENT).logLevel];

  debug(message: string, ...data: unknown[]): void {
    this.log('debug', message, data);
  }

  info(message: string, ...data: unknown[]): void {
    this.log('info', message, data);
  }

  warn(message: string, ...data: unknown[]): void {
    this.log('warn', message, data);
  }

  error(message: string, ...data: unknown[]): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data: unknown[]): void {
    if (LEVELS[level] < this.minLevel) return;
    const line = `[GC Docs] ${message}`;
    if (level === 'error') console.error(line, ...data);
    else console.warn(line, ...data);
  }
}
