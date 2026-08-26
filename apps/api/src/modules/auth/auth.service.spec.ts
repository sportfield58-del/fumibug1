import { HttpException } from '@nestjs/common';
import { MeResponseSchema } from '@fumibug/contracts';
import { AuthService } from './auth.service';
import type { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import type { RequestTx } from '../../common/tenant/prisma-tenant.extension';

/**
 * /auth/me contra un tx falso. El punto clave: la respuesta debe parsear contra
 * MeResponseSchema de @fumibug/contracts — si el mapeo diverge del contrato, este
 * test rompe ANTES de que lo descubra el frontend.
 */
describe('AuthService.me', () => {
  const NOW = new Date('2026-08-24T12:00:00Z');

  const USER_ROW = {
    id: '11111111-1111-4111-8111-111111111101',
    email: 'carlos@fumibug.dev',
    username: 'carlos',
    fullName: 'Carlos Pérez',
    phone: null,
    avatarUrl: null,
    color: '#1A6B4A',
    isActive: true,
    lastLoginAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const TENANT_ROW = {
    id: '22222222-2222-4222-8222-222222222201',
    name: 'Fumibug',
    slug: 'fumibug',
    legalName: null,
    taxId: null,
    healthAuthorizationNumber: null,
    logoUrl: null,
    address: null,
    phone: null,
    email: null,
    timezone: 'America/Argentina/Buenos_Aires',
    plan: 'CORE',
    status: 'ACTIVE',
    settings: {},
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  function serviceWith(rows: {
    user?: typeof USER_ROW | null;
    tenant?: typeof TENANT_ROW | null;
  }): AuthService {
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue(rows.user ?? null) },
      tenant: { findUnique: jest.fn().mockResolvedValue(rows.tenant ?? null) },
    } as unknown as RequestTx;
    return new AuthService({ current: () => tx } as unknown as TenantPrismaService);
  }

  function requestUser(): Parameters<AuthService['me']>[0] {
    return {
      userId: 'u-1',
      email: 'carlos@fumibug.dev',
      tenantId: 't-1',
      roleKey: 'admin',
      permissions: ['customer.read', 'customer.create'],
    };
  }

  it('devuelve usuario + tenant + rol + permisos y CUMPLE MeResponseSchema', async () => {
    const result = await serviceWith({ user: USER_ROW, tenant: TENANT_ROW }).me(requestUser());
    expect(result.roleKey).toBe('admin');
    expect(() => MeResponseSchema.parse(result)).not.toThrow();
    expect(result.user.createdAt).toBe(NOW.toISOString());
    expect(result.tenant.status).toBe('ACTIVE');
  });

  it('usuario inactivo → UNAUTHENTICATED aunque el token sea válido', async () => {
    const inactive = { ...USER_ROW, isActive: false };
    await expect(
      serviceWith({ user: inactive, tenant: TENANT_ROW }).me(requestUser()),
    ).rejects.toMatchObject({ response: { error: { code: 'UNAUTHENTICATED' } } });
  });

  it('usuario inexistente → UNAUTHENTICATED', async () => {
    await expect(serviceWith({ tenant: TENANT_ROW }).me(requestUser())).rejects.toMatchObject({
      response: { error: { code: 'UNAUTHENTICATED' } },
    });
  });

  it('tenant SUSPENDED → 403 TENANT_SUSPENDED', async () => {
    const suspended = { ...TENANT_ROW, status: 'SUSPENDED' };
    try {
      await serviceWith({ user: USER_ROW, tenant: suspended }).me(requestUser());
      fail('debía rechazar');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const body = (err as HttpException).getResponse() as { error?: { code?: string } };
      expect(body.error?.code).toBe('TENANT_SUSPENDED');
    }
  });

  it('sin transacción activa lanza en lugar de colarse sin scoping', async () => {
    const broken = new AuthService({
      current: () => {
        throw new Error('Fuera de la transacción del request.');
      },
    } as unknown as TenantPrismaService);
    await expect(broken.me(requestUser())).rejects.toThrow(/transacción/);
  });
});
