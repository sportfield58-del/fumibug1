import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { AuthService } from './auth.service';

/**
 * docs/spec/10-api.md §J.2 (Auth). El login/refresh vive en Supabase Auth (§K.1):
 * NestJS es authorization server. Por ahora el módulo expone /auth/me; los flujos
 * de PIN de operario y token_version llegan con PR 6.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Usuario, tenant, rol y permisos efectivos del token. Requiere JWT + tenant. */
  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    return apiSuccess(await this.auth.me(user));
  }
}
