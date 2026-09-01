import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import { UsersService } from './users.service';

/**
 * GET /roles — docs/spec/03-modulos.md §C.2 / contracts/endpoints.ts `listRoles`.
 *
 * Controller separado de `UsersController` porque el path del contrato es `/roles`, no
 * `/users/roles` — comparte `UsersService` (mismo módulo, `roles` es parte de la gestión
 * de usuarios, no tiene entidad propia de negocio todavía).
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('user.read')
  async list() {
    return apiSuccess(await this.users.listRoles());
  }
}
