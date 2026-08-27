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
  CreateUserRequest,
  UpdateUserRequest,
  UserListQuery,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { UsersService } from './users.service';

/**
 * docs/spec/03-modulos.md §C.2 / contracts/schemas/user.ts.
 *
 * Endpoints:
 *   GET  /users                  listar (paginado por cursor + filtros)
 *   GET  /users/:id              detalle
 *   POST /users                  alta (PIN para roles de campo)
 *   PATCH /users/:id             editar (requiere If-Match, VERSION_CONFLICT si no)
 *   POST /users/:id/activate     activar
 *   POST /users/:id/deactivate   desactivar
 *   POST /users/:id/reset-pin    nuevo PIN (operarios)
 *   POST /users/:id/force-logout revocar sesiones en Supabase
 *
 * Guardas: JwtGuard (global) + TenantGuard (global) + PermissionGuard acá abajo.
 * RLS NO filtra `users` (tabla global sin tenant_id) — el aislamiento lo aplica
 * UsersService arrancando siempre desde `memberships` del tenant actual.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('user.read')
  async list(@Query() query: UserListQuery) {
    const { data, meta } = await this.users.list(query);
    return { success: true as const, data, meta };
  }

  @Get(':id')
  @RequirePermission('user.read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.users.getById(id));
  }

  @Post()
  @RequirePermission('user.create')
  async create(@Body() body: CreateUserRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.users.create(body, user));
  }

  @Patch(':id')
  @RequirePermission('user.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRequest,
    @Headers('if-match') ifMatch: string | undefined,
  ) {
    return apiSuccess(await this.users.update(id, body, ifMatch ?? null));
  }

  @Post(':id/activate')
  @RequirePermission('user.update')
  async activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.users.setActive(id, true, user));
  }

  @Post(':id/deactivate')
  @RequirePermission('user.update')
  async deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.users.setActive(id, false, user));
  }

  @Post(':id/reset-pin')
  @RequirePermission('user.update')
  async resetPin(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.users.resetPin(id));
  }

  @Post(':id/force-logout')
  @RequirePermission('user.update')
  async forceLogout(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.users.forceLogout(id));
  }
}
