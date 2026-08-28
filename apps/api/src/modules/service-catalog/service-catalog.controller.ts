import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type {
  CreatePriceListRequest,
  CreateServiceTypeRequest,
  CreateZoneRequest,
  UpdatePriceListRequest,
  UpdateServiceTypeRequest,
  UpdateZoneRequest,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { ServiceCatalogService } from './service-catalog.service';

/**
 * docs/spec/03-modulos.md §C.19, contracts endpoints (PR-103).
 *
 * Lectura sin @RequirePermission a propósito: son catálogos que cualquier usuario
 * autenticado necesita (ej. el combo de tipo de servicio al dar de alta un servicio,
 * `alta rápida de servicio` no es exclusivo de settings.manage). Escritura sí exige
 * `settings.manage` — no hay una permission key dedicada a estos tres recursos en
 * PERMISSION_KEY (packages/contracts/src/permissions.ts), y §C.19 los agrupa bajo
 * "Configuración" en el catálogo de permisos.
 */
@Controller()
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get('service-types')
  async listServiceTypes() {
    return apiSuccess(await this.catalog.listServiceTypes());
  }

  @Post('service-types')
  @RequirePermission('settings.manage')
  async createServiceType(@Body() body: CreateServiceTypeRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.catalog.createServiceType(body, user));
  }

  @Patch('service-types/:id')
  @RequirePermission('settings.manage')
  async updateServiceType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateServiceTypeRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.catalog.updateServiceType(id, body, ifMatch ?? null));
  }

  @Get('zones')
  async listZones() {
    return apiSuccess(await this.catalog.listZones());
  }

  @Post('zones')
  @RequirePermission('settings.manage')
  async createZone(@Body() body: CreateZoneRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.catalog.createZone(body, user));
  }

  @Patch('zones/:id')
  @RequirePermission('settings.manage')
  async updateZone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateZoneRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.catalog.updateZone(id, body, ifMatch ?? null));
  }

  @Get('price-lists')
  async listPriceLists() {
    return apiSuccess(await this.catalog.listPriceLists());
  }

  @Post('price-lists')
  @RequirePermission('settings.manage')
  async createPriceList(@Body() body: CreatePriceListRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.catalog.createPriceList(body, user));
  }

  @Patch('price-lists/:id')
  @RequirePermission('settings.manage')
  async updatePriceList(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePriceListRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.catalog.updatePriceList(id, body, ifMatch ?? null));
  }
}
