import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ServiceListQuerySchema,
  type CancelServiceRequest,
  type CreateServiceRequest,
  type RejectServiceRequest,
  type ReopenServiceRequest,
  type RescheduleServiceRequest,
  type ServiceListQuery,
  type UpdateServiceRequest,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../../common/tenant/request-context';
import { ServicesService } from './services.service';

/** docs/spec/03-modulos.md §C.6, contracts endpoints (PR-104). */
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermission('service.read.own', 'service.read.tenant')
  async list(
    @Query(new ZodValidationPipe(ServiceListQuerySchema)) query: ServiceListQuery,
    @CurrentUser() user: RequestUser,
  ) {
    const { data, meta } = await this.services.list(query, user);
    return { success: true as const, data, meta };
  }

  @Post()
  @RequirePermission('service.create')
  async create(@Body() body: CreateServiceRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.services.create(body, user));
  }

  @Get(':id')
  @RequirePermission('service.read.own', 'service.read.tenant')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.services.getById(id));
  }

  @Patch(':id')
  @RequirePermission('service.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateServiceRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.services.update(id, body, ifMatch ?? null));
  }

  @Post(':id/cancel')
  @RequirePermission('service.cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelServiceRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.services.cancel(id, body, user));
  }

  @Post(':id/reschedule')
  @RequirePermission('service.reschedule')
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleServiceRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.services.reschedule(id, body, user));
  }

  @Post(':id/validate')
  @RequirePermission('service.validate')
  async validate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.services.validate(id, user));
  }

  @Post(':id/reject')
  @RequirePermission('service.reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectServiceRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.services.reject(id, body, user));
  }

  @Post(':id/reopen')
  @RequirePermission('session.reopen')
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReopenServiceRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.services.reopen(id, body, user));
  }

  @Post(':id/warranty-visit')
  @RequirePermission('service.create')
  async warrantyVisit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.services.warrantyVisit(id, user));
  }
}
