import { Injectable } from '@nestjs/common';
import type { MeResponse } from '@fumibug/contracts';
import { httpApiError } from '../../common/http/api-response';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import type { RequestUser } from '../../common/tenant/request-context';

/**
 * GET /auth/me — docs/spec/10-api.md §J.2 y contracts/schemas/auth.ts (MeResponse).
 *
 * Además de servir al frontend, este endpoint es la prueba end-to-end del cableado
 * de PR 5: JwtGuard verificó el token → TenantGuard fijó el tenant →
 * TransactionInterceptor abrió la transacción con SET LOCAL app.tenant_id → las
 * queries corren por la extensión (Capa 1) contra el rol fumibug_app con RLS
 * (Capa 2). Si alguna capa estuviera mal, acá se rompe.
 */
@Injectable()
export class AuthService {
  constructor(private readonly db: TenantPrismaService) {}

  async me(user: RequestUser): Promise<MeResponse> {
    const tx = this.db.current();

    const dbUser = await tx.user.findUnique({ where: { id: user.userId } });
    if (!dbUser || !dbUser.isActive) {
      // Token válido pero usuario borrado/desactivado después de emitirse.
      throw httpApiError('UNAUTHENTICATED', 'Usuario inexistente o inactivo.', 401);
    }

    const tenant = await tx.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) {
      // Inalcanzable en operación normal: el tenant_id viene del claim verificado
      // y RLS filtra exactamente ese id. Si ocurre, hay un bug de cableado grave.
      throw httpApiError(
        'INTERNAL_ERROR',
        'Tenant del token no visible en la base. Reportar con requestId.',
        500,
      );
    }
    if (tenant.status === 'SUSPENDED') {
      throw httpApiError('TENANT_SUSPENDED', 'La empresa está suspendida.', 403);
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        username: dbUser.username,
        fullName: dbUser.fullName,
        phone: dbUser.phone,
        avatarUrl: dbUser.avatarUrl,
        color: dbUser.color,
        isActive: dbUser.isActive,
        lastLoginAt: toIso(dbUser.lastLoginAt),
        createdAt: toIso(dbUser.createdAt) ?? '',
        updatedAt: toIso(dbUser.updatedAt) ?? '',
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        legalName: tenant.legalName,
        taxId: tenant.taxId,
        healthAuthorizationNumber: tenant.healthAuthorizationNumber,
        logoUrl: tenant.logoUrl,
        address: tenant.address,
        phone: tenant.phone,
        email: tenant.email,
        timezone: tenant.timezone,
        plan: tenant.plan,
        status: tenant.status,
        settings: tenant.settings as Record<string, unknown>,
        createdAt: toIso(tenant.createdAt) ?? '',
        updatedAt: toIso(tenant.updatedAt) ?? '',
      },
      roleKey: user.roleKey,
      permissions: user.permissions,
    };
  }
}

/** Wire format §J.3: fechas ISO-8601 string, no Date serializado. */
function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
