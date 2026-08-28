import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import {
  RouteListQuerySchema,
  type AddStopRequest,
  type CreateRouteRequest,
  type ReassignRouteRequest,
  type ReorderStopsRequest,
  type RouteListQuery,
  type UpdateRouteRequest,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../../common/tenant/request-context';
import { RoutesService } from './routes.service';

/** docs/spec/03-modulos.md §C.7/§C.8, contracts endpoints (PR-105). */
@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  @RequirePermission('route.read.own', 'route.read.tenant')
  async list(
    @Query(new ZodValidationPipe(RouteListQuerySchema)) query: RouteListQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.routes.list(query, user));
  }

  @Post()
  @RequirePermission('route.create')
  async create(@Body() body: CreateRouteRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.routes.create(body, user));
  }

  @Get(':id')
  @RequirePermission('route.read.own', 'route.read.tenant')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.routes.getById(id));
  }

  @Patch(':id')
  @RequirePermission('route.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRouteRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.routes.update(id, body, ifMatch ?? null));
  }

  @Post(':id/stops')
  @RequirePermission('route.update')
  async addStop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddStopRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.routes.addStop(id, body, user));
  }

  @Put(':id/stops/order')
  @RequirePermission('route.update')
  async reorderStops(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReorderStopsRequest) {
    return apiSuccess(await this.routes.reorderStops(id, body));
  }

  @Delete(':id/stops/:stopId')
  @RequirePermission('route.update')
  async removeStop(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stopId', ParseUUIDPipe) stopId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.routes.removeStop(id, stopId, user));
  }

  @Post(':id/validate')
  @RequirePermission('route.read.own', 'route.read.tenant')
  async validate(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.routes.validate(id));
  }

  @Post(':id/publish')
  @RequirePermission('route.publish')
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.routes.publish(id, user));
  }

  @Post(':id/unpublish')
  @RequirePermission('route.unpublish')
  async unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.routes.unpublish(id, user));
  }

  @Post(':id/reassign')
  @RequirePermission('route.update')
  async reassign(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReassignRouteRequest) {
    return apiSuccess(await this.routes.reassign(id, body));
  }

  @Post(':id/cancel')
  @RequirePermission('route.cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.routes.cancel(id, user));
  }
}
