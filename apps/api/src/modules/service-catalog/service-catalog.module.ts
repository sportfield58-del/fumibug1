import { Module } from '@nestjs/common';
import { ServiceCatalogController } from './service-catalog.controller';
import { ServiceCatalogService } from './service-catalog.service';

/**
 * docs/spec/16-estructura.md §U / contracts/schemas/service-catalog.ts (PR-103).
 * Configuración del tenant: tipos de servicio, zonas y listas de precios.
 */
@Module({
  controllers: [ServiceCatalogController],
  providers: [ServiceCatalogService],
  exports: [ServiceCatalogService],
})
export class ServiceCatalogModule {}
