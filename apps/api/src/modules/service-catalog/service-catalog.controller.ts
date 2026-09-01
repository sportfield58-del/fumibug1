import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  CreatePriceListRequestSchema,
  CreateServiceTypeRequestSchema,
  CreateZoneRequestSchema,
  UpdatePriceListRequestSchema,
  UpdateServiceTypeRequestSchema,
  UpdateZoneRequestSchema,
  type CreatePriceListRequest,
  type CreateServiceTypeRequest,
  type CreateZoneRequest,
  type UpdatePriceListRequest,
  type UpdateServiceTypeRequest,
  type UpdateZoneRequest,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../../common/tenant/request-context';
import { ServiceCatalogService } from './service-catalog.service';

/**
 * docs/spec/03-modulos.md §C.19 (Configuración) / contracts endpoints (PR-103).
 *
 * Tipos de servicio, zonas y listas de precios son "Configuración" del tenant.
 * Solo Owner y Admin los tocan (docs/spec/02-roles.md §B.3), y el único permiso
 * existente que los cubre es `settings.manage` (no se inventa un permiso nuevo).
 *
 * Endpoints:
 *   GET/POST /service-types            · GET/POST /zones            · GET/POST /price-lists
 *   PATCH     /service-types/:id       · PATCH /zones/:id           · PATCH /price-lists/:id
 */
@Controller()
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get('service-types')
  @RequirePermission('settings.manage')
  async listServiceTypes() {
    return apiSuccess(await this.catalog.listServiceTypes());
  }

  @Post('service-types')
  @RequirePermission('settings.manage')
  async createServiceType(
    @Body(new ZodValidationPipe(CreateServiceTypeRequestSchema)) body: CreateServiceTypeRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.catalog.createServiceType(body, user));
  }

  @Patch('service-types/:id')
  @RequirePermission('settings.manage')
  async updateServiceType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateServiceTypeRequestSchema)) body: UpdateServiceTypeRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.catalog.updateServiceType(id, body, ifMatch ?? null));
  }

  @Get('zones')
  @RequirePermission('settings.manage')
  async listZones() {
    return apiSuccess(await this.catalog.listZones());
  }

  @Post('zones')
  @RequirePermission('settings.manage')
  async createZone(
    @Body(new ZodValidationPipe(CreateZoneRequestSchema)) body: CreateZoneRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.catalog.createZone(body, user));
  }

  @Patch('zones/:id')
  @RequirePermission('settings.manage')
  async updateZone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateZoneRequestSchema)) body: UpdateZoneRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.catalog.updateZone(id, body, ifMatch ?? null));
  }

  @Get('price-lists')
  @RequirePermission('settings.manage')
  async listPriceLists() {
    return apiSuccess(await this.catalog.listPriceLists());
  }

  @Post('price-lists')
  @RequirePermission('settings.manage')
  async createPriceList(
    @Body(new ZodValidationPipe(CreatePriceListRequestSchema)) body: CreatePriceListRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.catalog.createPriceList(body, user));
  }

  @Patch('price-lists/:id')
  @RequirePermission('settings.manage')
  async updatePriceList(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePriceListRequestSchema)) body: UpdatePriceListRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.catalog.updatePriceList(id, body, ifMatch ?? null));
  }
}
