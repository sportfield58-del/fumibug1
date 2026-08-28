import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  CreateCustomerRequest,
  CreateLocationRequest,
  CustomerListQuery,
  UpdateCustomerRequest,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { CustomersService } from './customers.service';
import { LocationsService } from './locations.service';

/**
 * docs/spec/03-modulos.md §C.3/§C.4, contracts endpoints (PR-102).
 *
 * Permisos (cotas §B.2/§B.3): customer.* y location.* por recurso/acción. Aislamiento
 * por tenant a cargo de la extensión de Prisma + RLS (tablas tenant-scoped, R40 → 404).
 *
 * Endpoints:
 *   GET   /customers                  listar (cursor, filtros type/search/archivados)
 *   POST  /customers                  alta (contactos embebidos)
 *   GET   /customers/:id              detalle con contactos
 *   PATCH /customers/:id              editar (If-Match, reemplaza contactos si llegan)
 *   POST  /customers/:id/archive      archivar (soft delete)
 *   GET   /customers/:id/summary      cuenta corriente + próximos servicios (ADR 0009)
 *   GET/POST /customers/:id/locations ubicaciones del cliente
 */
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly locations: LocationsService,
  ) {}

  @Get()
  @RequirePermission('customer.read')
  async list(@Query() query: CustomerListQuery) {
    return apiSuccess(await this.customers.list(query));
  }

  @Post()
  @RequirePermission('customer.create')
  async create(@Body() body: CreateCustomerRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.customers.create(body, user));
  }

  @Get(':id')
  @RequirePermission('customer.read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.customers.getById(id));
  }

  @Patch(':id')
  @RequirePermission('customer.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCustomerRequest,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.customers.update(id, body, ifMatch ?? null, user));
  }

  @Post(':id/archive')
  @RequirePermission('customer.archive')
  async archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.customers.archive(id, user));
  }

  @Get(':id/summary')
  @RequirePermission('customer.read')
  async getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.customers.getSummary(id));
  }

  @Get(':id/locations')
  @RequirePermission('location.read')
  async listLocations(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.locations.listByCustomer(id));
  }

  @Post(':id/locations')
  @RequirePermission('location.create')
  async createLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateLocationRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.locations.create(id, body, user));
  }
}
