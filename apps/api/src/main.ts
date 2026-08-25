// dotenv PRIMERO: Nest no carga .env solo (Next y el CLI de Prisma sí), y sin
// APP_DATABASE_URL el boot debe fallar con el mensaje de env, no con un error de
// conexión críptico. En producción las variables ya vienen inyectadas y esto es no-op.
import 'dotenv/config';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ENV } from './config/env.module';
import type { Env } from './config/env';
import { resolveCorsOrigins } from './config/env';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logging/structured-logger.service';
import { initSentry } from './common/observability/sentry';

/**
 * Prefijo /v1 desde el día 1 (docs/spec/10-api.md §J.1: "Versión en el path desde el
 * día 1"). El health check queda sin prefijo para los probes de Railway.
 *
 * Helmet con CSP estricta y CORS con allowlist explícita (§K.9: "no *, no reflejar el
 * origin"). El resto de la plataforma (guards, exception filter, rate limit,
 * auditoría, state machine) se cablea en AppModule — ver el comentario ahí.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const env = app.get<Env>(ENV);

  initSentry(env);
  app.useLogger(app.get(StructuredLogger));

  app.use(helmet());
  app.enableCors({
    origin: resolveCorsOrigins(env),
    credentials: true,
  });
  app.setGlobalPrefix('v1', { exclude: ['health'] });

  await app.listen(env.PORT);
  app.get(StructuredLogger).log(`fumibug-api escuchando en :${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

void bootstrap();
