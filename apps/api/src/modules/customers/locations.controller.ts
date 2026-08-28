import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { GeocodeLocationRequest, UpdateLocationRequest } from '@fumibug/contracts';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import { LocationsService } from './locations.service';

/**
 * docs/spec/03-modulos.md §C.4 / contracts endpoints (PR-102).
 *
 * Endpoints:
 *   GET   /locations/:id           detalle de ubicación
 *   PATCH /locations/:id           editar (If-Match)
 *   POST  /locations/:id/geocode   geocodificar (o corrección manual, ADR 0009)
 */
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get(':id')
  @RequirePermission('location.read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.locations.getById(id));
  }

  @Patch(':id')
  @RequirePermission('location.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLocationRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.locations.update(id, body, ifMatch ?? null));
  }

  @Post(':id/geocode')
  @RequirePermission('location.update')
  async geocode(@Param('id', ParseUUIDPipe) id: string, @Body() body: GeocodeLocationRequest) {
    return apiSuccess(await this.locations.geocode(id, body));
  }
}
