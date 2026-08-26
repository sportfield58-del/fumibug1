import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global — todo módulo de negocio de Fase 1 inyecta AuditService sin repetir imports. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
