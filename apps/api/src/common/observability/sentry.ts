import * as Sentry from '@sentry/node';
import type { Env } from '../../config/env';

/**
 * docs/spec/15-escalabilidad.md §R.2: "Lo único no negociable desde el día 1: Sentry
 * (errores) y logs estructurados en JSON."
 *
 * Sin SENTRY_DSN (desarrollo local, o todavía no se creó el proyecto de Sentry) queda
 * en no-op: Sentry.captureException sin init previo no rompe nada, así que no hace
 * falta un flag separado para "está habilitado" en el resto del código.
 */
export function initSentry(env: Env): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
  });
}

export function captureException(exception: unknown): void {
  Sentry.captureException(exception);
}
