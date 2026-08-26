import { Global, Module } from '@nestjs/common';
import { StructuredLogger } from './structured-logger.service';

/** Global — el filtro de excepciones y cualquier servicio inyectan StructuredLogger. */
@Global()
@Module({
  providers: [StructuredLogger],
  exports: [StructuredLogger],
})
export class LoggingModule {}
