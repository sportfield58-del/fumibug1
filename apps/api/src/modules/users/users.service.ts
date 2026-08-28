import { Injectable } from '@nestjs/common';
import type {
  CreateUserRequest,
  CreateUserResponse,
  LicenseType,
  UpdateUserRequest,
  ResetPinResponse,
  ForceLogoutResponse,
  PaginationMeta,
  UserListQuery,
  UserWithMembership,
} from '@fumibug/contracts';
import { randomUUID } from 'node:crypto';
import { httpApiError } from '../../common/http/api-response';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestUser } from '../../common/tenant/request-context';
import { SupabaseAuthAdminClient } from './supabase-auth-admin.client';
import { generatePin } from './pin';

/**
 * Módulo de usuarios — docs/spec/03-modulos.md §C.2, contracts/schemas/user.ts.
 *
 * NOTA de aislamiento (clave, ver migraciones de RLS): `users` es UNA tabla global SIN
 * tenant_id y SIN RLS (§H.2 — un usuario puede pertenecer a varios tenants vía membership).
 * El aislamiento se hace acá, en la capa de aplicación: TODAS las queries de usuario
 * arrancan desde `memberships` (que SÍ es RLS-scoped por app.tenant_id) y derivan el
 * usuario de ahí. Nunca se consulta `user` por id directo sin haber verificado una
 * membership en el tenant actual — si no existe, se responde 404 (R40, sin filtrar que
 * el usuario existe en otro tenant).
 *
 * Los roles de campo son los que tienen ficha de operario (technician_profiles): por
 * semilla, `technician` y `technical_director`. Solo esos reciben PIN y se crean en
 * Supabase Auth (docs/spec/11-seguridad.md §K.1). El resto (owner/admin/supervisor/office)
 * son cuentas con email.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseAuthAdminClient,
  ) {}

  /** Robusto ante `roleKey` custom: cierto si la ficha de operario corresponde. */
  private static readonly FIELD_ROLE_KEYS = new Set(['technician', 'technical_director']);

  async list(query: UserListQuery): Promise<{ data: UserWithMembership[]; meta: PaginationMeta }> {
    const tx = this.db.current();
    const limit = query.limit ?? 20;

    const memberships = await tx.membership.findMany({
      where: {
        ...this.membershipFilters(query),
        ...(query.cursor ? this.cursorWhere(query.cursor) : {}),
      },
      take: limit + 1,
      orderBy: [{ joinedAt: 'desc' }, { id: 'desc' }],
      include: {
        user: { include: { technicianProfile: true } },
        role: true,
      },
    });

    const hasMore = memberships.length > limit;
    const page = hasMore ? memberships.slice(0, limit) : memberships;
    const last = page[page.length - 1];

    const data = page.map((m) => toUserWithMembership(m));

    return {
      data,
      meta: {
        cursor: hasMore && last ? this.encodeCursor(last.joinedAt, last.id) : null,
        hasMore,
        total: await tx.membership.count({ where: this.membershipFilters(query) }),
      },
    };
  }

  async getById(id: string): Promise<UserWithMembership> {
    const membership = await this.findMembershipInTenant(id);
    if (!membership) throw httpApiError('NOT_FOUND', 'Usuario no encontrado.', 404);
    return toUserWithMembership(membership);
  }

  async create(input: CreateUserRequest, actor: RequestUser): Promise<CreateUserResponse> {
    const tx = this.db.current();

    const role = await tx.role.findUnique({ where: { id: input.roleId } });
    if (!role) {
      throw httpApiError(
        'NOT_FOUND',
        'El rol no existe en este tenant.',
        404,
      );
    }
    const isFieldRole = UsersService.FIELD_ROLE_KEYS.has(role.key);
    if (isFieldRole && !input.technicianProfile) {
      throw httpApiError(
        'VALIDATION_ERROR',
        'El rol de operario/técnico requiere la ficha de operario (technicianProfile).',
        400,
      );
    }

    const userId = randomUUID();
    // Un campo por identidad a la vez: email real (admin) o username (operario→email interno).
    const email = input.email ?? (input.username ? `${input.username}@fumibug.internal` : null);
    if (!email) {
      throw httpApiError(
        'VALIDATION_ERROR',
        'Se requiere email o username.',
        400,
      );
    }
    if (input.email && input.username) {
      throw httpApiError(
        'VALIDATION_ERROR',
        'Proporcioná email O username, no ambos.',
        400,
      );
    }

    let temporaryPin: string | null = null;
    if (isFieldRole) {
      temporaryPin = generatePin();
      // Si Supabase Auth Admin no está configurado esto lanza con error accionable:
      // no se deja un operario con cuenta de Supabase inexistente a medias.
      await this.supabase.createUser({
        email,
        ...(input.username !== undefined ? { username: input.username } : {}),
        temporaryPin,
      });
    }

    await tx.user.create({
      data: {
        id: userId,
        email,
        username: input.username ?? null,
        fullName: input.fullName,
        phone: input.phone ?? null,
        color: input.color ?? null,
        isActive: true,
      },
    });

    await tx.membership.create({
      data: {
        tenantId: actor.tenantId,
        userId,
        roleId: role.id,
        status: 'ACTIVE',
      },
    });

    if (input.technicianProfile) {
      await tx.technicianProfile.upsert({
        where: { userId },
        create: {
          userId,
          tenantId: actor.tenantId,
          licenseNumber: input.technicianProfile.licenseNumber ?? null,
          licenseType: input.technicianProfile.licenseType,
          licenseExpiresAt: input.technicianProfile.licenseExpiresAt
            ? new Date(input.technicianProfile.licenseExpiresAt)
            : null,
          vehicleId: input.technicianProfile.vehicleId ?? null,
          stockLocationId: input.technicianProfile.stockLocationId ?? null,
        },
        update: {},
      });
    }

    await this.audit.record({
      action: 'user.create',
      entityType: 'user',
      entityId: userId,
      severity: 'INFO',
      after: {
        email,
        roleKey: role.key,
        isFieldRole,
        technicianProfile: input.technicianProfile ?? undefined,
      },
    });

    const membership = await this.findMembershipInTenant(userId);
    if (!membership) throw httpApiError('INTERNAL_ERROR', 'Membership no visible tras crear.', 500);

    return {
      user: toUserWithMembership(membership),
      ...(temporaryPin ? { temporaryPin } : {}),
    };
  }

  async update(id: string, input: UpdateUserRequest, ifMatch: string | null): Promise<UserWithMembership> {
    const membership = await this.findMembershipInTenant(id);
    if (!membership) throw httpApiError('NOT_FOUND', 'Usuario no encontrado.', 404);

    // Versión optimista — docs/spec/10-api.md: PATCH exige If-Match (VERSION_CONFLICT).
    const expectedEtag = `"${membership.user.updatedAt.toISOString()}"`;
    if (!ifMatch || ifMatch.trim() !== expectedEtag) {
      throw httpApiError('VERSION_CONFLICT', 'If-Match no coincide: actualizá tus datos.', 409);
    }

    const tx = this.db.current();
    const before = { fullName: membership.user.fullName, phone: membership.user.phone };

    await tx.user.update({
      where: { id: membership.user.id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });

    if (input.technicianProfile) {
      // UpdateUserRequest no expone `licenseType` (es inmutable tras el alta): solo se
      // actualiza una ficha YA existente. No se convierte una cuenta en operario acá —
      // ese cambio de rol es otro flujo (endpoint aparte, ver spec).
      if (!membership.user.technicianProfile) {
        throw httpApiError(
          'VALIDATION_ERROR',
          'Este usuario no tiene ficha de operario; no se puede editar técnico por acá.',
          400,
        );
      }
      const p = input.technicianProfile;
      await tx.technicianProfile.update({
        where: { userId: membership.user.id },
        data: {
          ...(p.licenseNumber !== undefined ? { licenseNumber: p.licenseNumber } : {}),
          ...(p.licenseExpiresAt !== undefined
            ? { licenseExpiresAt: p.licenseExpiresAt ? new Date(p.licenseExpiresAt) : null }
            : {}),
          ...(p.vehicleId !== undefined ? { vehicleId: p.vehicleId } : {}),
          ...(p.stockLocationId !== undefined ? { stockLocationId: p.stockLocationId } : {}),
        },
      });
    }

    await this.audit.record({
      action: 'user.update',
      entityType: 'user',
      entityId: id,
      before,
      after: {
        fullName: input.fullName ?? undefined,
        phone: input.phone ?? undefined,
        technicianProfile: input.technicianProfile ?? undefined,
      },
    });

    const updated = await this.findMembershipInTenant(id);
    if (!updated) throw httpApiError('INTERNAL_ERROR', 'Usuario no visible tras actualizar.', 500);
    return toUserWithMembership(updated);
  }

  async setActive(id: string, active: boolean, actor: RequestUser): Promise<UserWithMembership> {
    const membership = await this.findMembershipInTenant(id);
    if (!membership) throw httpApiError('NOT_FOUND', 'Usuario no encontrado.', 404);

    const tx = this.db.current();
    await tx.user.update({ where: { id: membership.user.id }, data: { isActive: active } });
    await tx.membership.update({
      where: { tenantId_userId: { tenantId: actor.tenantId, userId: membership.user.id } },
      data: { status: active ? 'ACTIVE' : 'SUSPENDED' },
    });

    await this.audit.record({
      action: active ? 'user.activate' : 'user.deactivate',
      entityType: 'user',
      entityId: id,
      severity: 'INFO',
      after: { isActive: active },
      diff: { beforeStatus: 'ACTIVE', afterStatus: active ? 'ACTIVE' : 'SUSPENDED' },
    });

    const updated = await this.findMembershipInTenant(id);
    if (!updated) throw httpApiError('INTERNAL_ERROR', 'Usuario no visible tras el cambio.', 500);
    return toUserWithMembership(updated);
  }

  async resetPin(id: string): Promise<ResetPinResponse> {
    const membership = await this.findMembershipInTenant(id);
    if (!membership) throw httpApiError('NOT_FOUND', 'Usuario no encontrado.', 404);

    const newPin = generatePin();
    await this.supabase.resetPassword(id, newPin);

    await this.audit.record({
      action: 'user.reset-pin',
      entityType: 'user',
      entityId: id,
      severity: 'CRITICAL',
      after: { resetAt: new Date().toISOString() },
    });

    return { temporaryPin: newPin };
  }

  async forceLogout(id: string): Promise<ForceLogoutResponse> {
    const membership = await this.findMembershipInTenant(id);
    if (!membership) throw httpApiError('NOT_FOUND', 'Usuario no encontrado.', 404);

    const revoked = await this.supabase.revokeUserSessions(id);

    await this.audit.record({
      action: 'user.force-logout',
      entityType: 'user',
      entityId: id,
      severity: 'CRITICAL',
      after: { revokedSessions: revoked, at: new Date().toISOString() },
    });

    return { revokedSessions: revoked };
  }

  private async findMembershipInTenant(userId: string) {
    const tx = this.db.current();
    return tx.membership.findFirst({
      where: { userId },
      include: {
        user: { include: { technicianProfile: true } },
        role: true,
      },
    });
  }

  private membershipFilters(query: UserListQuery): Record<string, unknown> {
    const userFilter: Record<string, unknown> = {};
    if (query.isActive !== undefined) userFilter.isActive = query.isActive;
    if (query.search) {
      userFilter.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return {
      ...(Object.keys(userFilter).length ? { user: userFilter } : {}),
      ...(query.roleKey !== undefined ? { role: { key: query.roleKey } } : {}),
    };
  }

  private cursorWhere(cursor: string): Record<string, unknown> {
    // Cursor compuesto "joinedAt__id" para paginación por claves (R40). El separador
    // __ no aparece en un UUID ni en un ISO-8601 con Z cortado.
    const sep = cursor.lastIndexOf('__');
    if (sep <= 0) return {};
    const joinedAt = cursor.slice(0, sep);
    const id = cursor.slice(sep + 2);
    const at = new Date(joinedAt);
    if (Number.isNaN(at.getTime())) return {};
    return {
      OR: [
        { joinedAt: { lt: at } },
        { AND: [{ joinedAt: at }, { id: { lt: id } }] },
      ],
    };
  }

  private encodeCursor(at: Date, id: string): string {
    return `${at.toISOString()}__${id}`;
  }
}

function toUserWithMembership(m: {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  status: string;
  joinedAt: Date;
  user: {
    id: string;
    email: string;
    username: string | null;
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    color: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    technicianProfile?: {
      userId: string;
      tenantId: string;
      licenseNumber: string | null;
      licenseType: string;
      licenseExpiresAt: Date | null;
      signatureUrl: string | null;
      vehicleId: string | null;
      stockLocationId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  };
  role: { id: string; key: string; name: string };
}): UserWithMembership {
  const u = m.user;
  const tp = u.technicianProfile;
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    fullName: u.fullName,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    color: u.color,
    isActive: u.isActive,
    lastLoginAt: toIso(u.lastLoginAt),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    membershipStatus: m.status as UserWithMembership['membershipStatus'],
    roleId: m.role.id,
    roleKey: m.role.key,
    roleName: m.role.name,
    ...(tp
      ? {
          technicianProfile: {
            userId: tp.userId,
            tenantId: tp.tenantId,
            licenseNumber: tp.licenseNumber,
            licenseType: tp.licenseType as LicenseType,
            licenseExpiresAt: toDateStr(tp.licenseExpiresAt),
            signatureUrl: tp.signatureUrl,
            vehicleId: tp.vehicleId,
            stockLocationId: tp.stockLocationId,
            createdAt: tp.createdAt.toISOString(),
            updatedAt: tp.updatedAt.toISOString(),
          },
        }
      : {}),
  };
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toDateStr(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
