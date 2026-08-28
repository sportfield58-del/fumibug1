import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type {
  CreateSupplyUsageRequest,
  FieldCashCloseRequest,
  FinishSessionRequest,
  SessionActionRequest,
  SessionPaymentRequest,
  SessionSignatureRequest,
  StartSessionRequest,
  StopGpsEventRequest,
  StopOutcomeRequest,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { FieldService } from './field.service';

/**
 * docs/spec/10-api.md §J.2 "App de campo". Todos los permisos acá son los que el seed
 * (packages/db/prisma/seed.ts) ya le da al rol `technician` — ver PR-106b en el task
 * board para el detalle de por qué cada endpoint usa la key que usa.
 */
@Controller('field')
export class FieldController {
  constructor(private readonly field: FieldService) {}

  @Get('today')
  async today(@CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.getToday(user));
  }

  @Post('stops/:id/en-route')
  @RequirePermission('session.start')
  async enRoute(@Param('id', ParseUUIDPipe) id: string, @Body() body: StopGpsEventRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.markEnRoute(id, body, user));
  }

  @Post('stops/:id/arrive')
  @RequirePermission('session.start')
  async arrive(@Param('id', ParseUUIDPipe) id: string, @Body() body: StopGpsEventRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.markArrive(id, body, user));
  }

  @Post('stops/:id/no-show')
  @RequirePermission('stop.mark_no_show')
  async noShow(@Param('id', ParseUUIDPipe) id: string, @Body() body: StopOutcomeRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.markNoShow(id, body, user));
  }

  @Post('stops/:id/inaccessible')
  @RequirePermission('stop.skip')
  async inaccessible(@Param('id', ParseUUIDPipe) id: string, @Body() body: StopOutcomeRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.markInaccessible(id, body, user));
  }

  @Post('services/:id/start')
  @RequirePermission('session.start')
  async start(@Param('id', ParseUUIDPipe) id: string, @Body() body: StartSessionRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.startSession(id, body, user));
  }

  @Post('sessions/:id/pause')
  @RequirePermission('session.start')
  async pause(@Param('id', ParseUUIDPipe) id: string, @Body() body: SessionActionRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.pauseSession(id, body, user));
  }

  @Post('sessions/:id/resume')
  @RequirePermission('session.start')
  async resume(@Param('id', ParseUUIDPipe) id: string, @Body() body: SessionActionRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.resumeSession(id, body, user));
  }

  @Post('sessions/:id/supplies')
  @RequirePermission('session.start')
  async addSupplyUsage(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreateSupplyUsageRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.createSupplyUsage(id, body, user));
  }

  @Post('sessions/:id/signature')
  @RequirePermission('session.start')
  async signature(@Param('id', ParseUUIDPipe) id: string, @Body() body: SessionSignatureRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.setSignature(id, body, user));
  }

  @Post('sessions/:id/payment')
  @RequirePermission('payment.create')
  async payment(@Param('id', ParseUUIDPipe) id: string, @Body() body: SessionPaymentRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.createPayment(id, body, user));
  }

  @Post('sessions/:id/finish')
  @RequirePermission('session.finish')
  async finish(@Param('id', ParseUUIDPipe) id: string, @Body() body: FinishSessionRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.finishSession(id, body, user));
  }

  @Get('my-stock')
  @RequirePermission('inventory.read.own', 'inventory.read.tenant')
  async myStock(@CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.getMyStock(user));
  }

  @Post('cash/close')
  @RequirePermission('cash.close.own')
  async closeCash(@Body() body: FieldCashCloseRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.field.closeCash(body, user));
  }
}
