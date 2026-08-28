import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type {
  CreateInventoryMovementRequest,
  CreateSupplyRequest,
  InventoryListQuery,
  InventoryMovementListQuery,
  UpdateSupplyRequest,
} from '@fumibug/contracts';
import { InventoryListQuerySchema, InventoryMovementListQuerySchema } from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { InventoryService } from './inventory.service';

/**
 * docs/spec/13-inventario-caja.md §N, contracts (hoy). Lectura de catálogo sin permiso
 * dedicado (igual que service-catalog: cualquier autenticado necesita el combo de
 * insumos). Saldo y movimientos sí exigen los permission keys de §I.
 */
@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('supplies')
  async listSupplies() {
    return apiSuccess(await this.inventory.listSupplies());
  }

  @Post('supplies')
  @RequirePermission('supply.create')
  async createSupply(@Body() body: CreateSupplyRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.inventory.createSupply(body, user));
  }

  @Patch('supplies/:id')
  @RequirePermission('supply.update')
  async updateSupply(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateSupplyRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.inventory.updateSupply(id, body, user));
  }

  @Get('stock-locations')
  @RequirePermission('inventory.read.own', 'inventory.read.tenant')
  async listStockLocations(@CurrentUser() user: RequestUser) {
    return apiSuccess(await this.inventory.listStockLocations(user));
  }

  @Get('inventory')
  @RequirePermission('inventory.read.own', 'inventory.read.tenant')
  async listInventory(@Query(new ZodValidationPipe(InventoryListQuerySchema)) query: InventoryListQuery, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.inventory.listInventory(query, user));
  }

  @Get('inventory/movements')
  @RequirePermission('inventory.read.own', 'inventory.read.tenant')
  async listMovements(@Query(new ZodValidationPipe(InventoryMovementListQuerySchema)) query: InventoryMovementListQuery) {
    return apiSuccess(await this.inventory.listMovements(query));
  }

  @Post('inventory/movements')
  @RequirePermission('inventory.transfer', 'inventory.adjust')
  async createMovement(@Body() body: CreateInventoryMovementRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.inventory.createMovement(body, user));
  }
}
