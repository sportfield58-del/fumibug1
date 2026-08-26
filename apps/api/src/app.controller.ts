import { Controller, Get } from '@nestjs/common';
import { Public } from './common/guards/public.decorator';
import { RequirePermission } from './common/decorators/require-permission.decorator';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { apiSuccess } from './common/http/api-response';
import { AuditService } from './common/audit/audit.service';
import type { RequestUser } from './common/tenant/request-context';
import type { ApiSuccess } from '@fumibug/contracts';

interface PingResponse {
  userId: string;
  tenantId: string;
  roleKey: string;
  permissions: string[];
}

@Controller()
export class AppController {
  constructor(private readonly audit: AuditService) {}

  /** Health check sin autenticar, para probes de Railway y smoke tests. */
  @Public()
  @Get('health')
  health(): { status: 'ok'; service: 'fumibug-api' } {
    return { status: 'ok', service: 'fumibug-api' };
  }

  /**
   * Criterio de salida de la Fase 0 (CLAUDE.md, prompts/PROMPT_FASE_0_CLAUDE_CODE.md):
   * un endpoint dummy autenticado, con tenant, con permiso verificado y auditado. No
   * es negocio — es la prueba de que las capas de plataforma están cableadas de punta
   * a punta: JwtGuard → RateLimitGuard → TenantGuard → PermissionGuard →
   * TransactionInterceptor → AuditService, todo dentro de la misma transacción (§K.10).
   *
   * Usa `audit.read` porque es el permiso existente del catálogo más cercano en
   * espíritu a "ver diagnóstico del sistema" — no se inventó un permiso nuevo solo
   * para este endpoint dummy.
   */
  @RequirePermission('audit.read')
  @Get('ping')
  async ping(@CurrentUser() user: RequestUser): Promise<ApiSuccess<PingResponse>> {
    await this.audit.record({ action: 'ping', entityType: 'system', severity: 'INFO' });
    return apiSuccess({
      userId: user.userId,
      tenantId: user.tenantId,
      roleKey: user.roleKey,
      permissions: user.permissions,
    });
  }
}
