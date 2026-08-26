import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { RequestMiddleware } from './request.middleware';
import { TenantPrismaService } from './tenant-prisma.service';

/**
 * Infraestructura transversal de tenant: contexto por request (AsyncLocalStorage)
 * y cliente Prisma con la extensión de scoping (docs/spec/16-estructura.md §U,
 * common/tenant = "AsyncLocalStorage + extensión Prisma").
 *
 * Global para que guards, interceptores y módulos de feature inyecten sin repetir
 * imports en cada módulo nuevo.
 */
@Global()
@Module({
  providers: [RequestContextService, RequestMiddleware, TenantPrismaService],
  exports: [RequestContextService, TenantPrismaService, RequestMiddleware],
})
export class TenantModule {}
