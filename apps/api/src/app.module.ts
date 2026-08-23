import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

/**
 * Fase 0: sin módulos de negocio. Los módulos feature-based (auth, customers,
 * routes, field, ...) se agregan a partir de Fase 1, uno por PR de contrato +
 * implementación (ver docs/spec/16-estructura.md y CLAUDE.md §6).
 */
@Module({
  controllers: [AppController],
})
export class AppModule {}
