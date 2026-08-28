import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type {
  CashClosureListQuery,
  CashMovementListQuery,
  CreateCashMovementRequest,
  CreatePaymentRequest,
  DeclareCashClosureRequest,
  PaymentListQuery,
  ReconcileCashClosureRequest,
  VoidPaymentRequest,
} from '@fumibug/contracts';
import { CashClosureListQuerySchema, CashMovementListQuerySchema, PaymentListQuerySchema } from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { CashService } from './cash.service';

/** docs/spec/13-inventario-caja.md §O, contracts (hoy). */
@Controller()
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('cash/accounts')
  @RequirePermission('cash.read.own', 'cash.read.tenant')
  async listAccounts(@CurrentUser() user: RequestUser) {
    return apiSuccess(await this.cash.listCashAccounts(user));
  }

  @Get('cash/accounts/:id/movements')
  @RequirePermission('cash.read.own', 'cash.read.tenant')
  async listMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(CashMovementListQuerySchema)) query: CashMovementListQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.cash.listMovements(id, query, user));
  }

  @Post('cash/accounts/:id/movements')
  @RequirePermission('cash.adjust')
  async createMovement(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreateCashMovementRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.cash.createMovement(id, body, user));
  }

  @Get('payments')
  @RequirePermission('payment.read.own', 'payment.read.tenant')
  async listPayments(@Query(new ZodValidationPipe(PaymentListQuerySchema)) query: PaymentListQuery, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.cash.listPayments(query, user));
  }

  @Post('payments')
  @RequirePermission('payment.create')
  async createPayment(@Body() body: CreatePaymentRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.cash.createPayment(body, user));
  }

  @Post('payments/:id/void')
  @RequirePermission('payment.void')
  async voidPayment(@Param('id', ParseUUIDPipe) id: string, @Body() body: VoidPaymentRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.cash.voidPayment(id, body, user));
  }

  @Get('cash/closures')
  @RequirePermission('cash.read.own', 'cash.read.tenant')
  async listClosures(@Query(new ZodValidationPipe(CashClosureListQuerySchema)) query: CashClosureListQuery) {
    return apiSuccess(await this.cash.listClosures(query));
  }

  @Post('cash/accounts/:id/closures')
  @RequirePermission('cash.close.own')
  async declareClosure(@Param('id', ParseUUIDPipe) id: string, @Body() body: DeclareCashClosureRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.cash.declareClosure(id, body, user));
  }

  @Post('cash/closures/:id/reconcile')
  @RequirePermission('cash.approve_closure')
  async reconcileClosure(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReconcileCashClosureRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.cash.reconcileClosure(id, body, user));
  }
}
