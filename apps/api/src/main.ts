// dotenv PRIMERO: Nest no carga .env solo (Next y el CLI de Prisma sí), y sin
// APP_DATABASE_URL el boot debe fallar con el mensaje de env, no con un error de
// conexión críptico. En producción las variables ya vienen inyectadas y esto es no-op.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ENV } from './config/env.module';
import type { Env } from './config/env';
import { AppModule } from './app.module';

/**
 * Fase 0: bootstrap mínimo. Helmet, CORS con allowlist, ValidationPipe global,
 * exception filter, logger estructurado y Sentry se agregan en PR 7
 * (ver docs/spec/11-seguridad.md).
 *
 * Prefijo /v1 desde el día 1 (docs/spec/10-api.md §J.1: "Versión en el path desde
 * el día 1"). El health check queda sin prefijo para los probes de Railway.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix('v1', { exclude: ['health'] });

  await app.listen(env.PORT);
  // Log mínimo de boot; el logger estructurado llega en PR 7.
  process.stdout.write(`fumibug-api escuchando en :${env.PORT} (${env.NODE_ENV})\n`);
}

void bootstrap();
