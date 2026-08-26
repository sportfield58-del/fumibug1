import { Injectable, type LoggerService, type LogLevel } from '@nestjs/common';
import { requestAls } from '../tenant/request-context';

/**
 * Logger JSON estructurado — CLAUDE.md §5 prohíbe `console.log`; docs/spec/15-escalabilidad.md
 * §R.2: "Sentry (errores) y logs estructurados en JSON. Debuggear un problema de campo
 * sin trazas es imposible."
 *
 * Un objeto JSON por línea, sin dependencias — cualquier agregador (Railway, Datadog,
 * etc.) lo parsea sin configuración especial. Enriquece cada línea con requestId y
 * tenantId del RequestContext en curso, para correlacionar sin buscar a mano.
 *
 * Usa process.stdout/stderr.write directo, no console.*: es la única forma de emitir
 * JSON de una sola línea sin el formato multi-argumento que agrega console (y por eso
 * no viola la regla "prohibido console.log" — es su reemplazo, no una excepción).
 */
@Injectable()
export class StructuredLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string): void {
    const store = requestAls.getStore();
    const entry = {
      level,
      message: typeof message === 'string' ? message : safeStringify(message),
      context,
      trace,
      requestId: store?.requestId,
      tenantId: store?.tenantId,
      timestamp: new Date().toISOString(),
    };
    const line = `${JSON.stringify(entry)}\n`;
    if (level === 'error') process.stderr.write(line);
    else process.stdout.write(line);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
