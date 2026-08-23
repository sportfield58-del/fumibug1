import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Fase 0: bootstrap mínimo. Helmet, CORS con allowlist, ValidationPipe global,
 * exception filter, logger estructurado y Sentry se agregan en PR 7
 * (ver docs/spec/11-seguridad.md).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

void bootstrap();
