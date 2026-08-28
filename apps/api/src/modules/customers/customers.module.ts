import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { LocationsController } from './locations.controller';
import { CustomersService } from './customers.service';
import { LocationsService } from './locations.service';
import { GEOCODING_PROVIDER, NoopGeocodingProvider } from './geocoding.provider';

/**
 * docs/spec/16-estructura.md §U / contracts/schemas/customer.ts (PR-102).
 *
 * Clientes + contactos + ubicaciones. El geocoding se inyecta por token
 * (GEOCODING_PROVIDER): por defecto NoopGeocodingProvider (sin red); el proveedor
 * real de Google se agrega aparte con su credencial sin tocar el módulo.
 */
@Module({
  controllers: [CustomersController, LocationsController],
  providers: [
    CustomersService,
    LocationsService,
    { provide: GEOCODING_PROVIDER, useClass: NoopGeocodingProvider },
  ],
  exports: [CustomersService, LocationsService],
})
export class CustomersModule {}
