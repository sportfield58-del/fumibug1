import { UserWithMembershipSchema, type LicenseType, type PermissionKey } from '@fumibug/contracts';
import { UsersService } from './users.service';
import type { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import type { AuditService } from '../../common/audit/audit.service';
import type { SupabaseAuthAdminClient } from './supabase-auth-admin.client';
import type { RequestUser } from '../../common/tenant/request-context';

const NOW = new Date('2026-08-27T12:00:00Z');

const UID = 'b0000000-0000-4000-8000-000000000001';
const TID = 'a0000000-0000-4000-8000-000000000001';
const RID = 'd0000000-0000-4000-8000-000000000001';

const MEMBER_ROW = {
  id: 'c0000000-0000-4000-8000-000000000001',
  tenantId: TID,
  userId: UID,
  roleId: RID,
  status: 'ACTIVE',
  joinedAt: NOW,
  user: {
    id: UID,
    email: 'diego@fumibug.dev',
    username: 'diego',
    fullName: 'Diego Operario',
    phone: null,
    avatarUrl: null,
    color: '#16A34A',
    isActive: true,
    lastLoginAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    technicianProfile: {
      userId: UID,
      tenantId: TID,
      licenseNumber: 'LS-4821',
      licenseType: 'SANITARY_BOOK',
      licenseExpiresAt: null,
      signatureUrl: null,
      vehicleId: null,
      stockLocationId: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  },
  role: { id: RID, key: 'technician', name: 'Operario' },
};

const ACTOR: RequestUser = {
  userId: 'admin-u',
  email: 'admin@fumibug.dev',
  tenantId: TID,
  roleKey: 'owner',
  permissions: ['user.create', 'user.update', 'user.read'] as PermissionKey[],
};

function buildService(overrides: {
  supabase?: Partial<SupabaseAuthAdminClient>;
} = {}) {
  const membershipFindFirst = jest.fn();
  const membershipFindMany = jest.fn();
  const membershipCount = jest.fn();
  const membershipCreate = jest.fn();
  const membershipUpdate = jest.fn();
  const userCreate = jest.fn();
  const userUpdate = jest.fn();
  const roleFindUnique = jest.fn();
  const profileUpsert = jest.fn();
  const profileUpdate = jest.fn();
  const supabaseCreateUser = jest.fn().mockResolvedValue(undefined);
  const supabaseResetPassword = jest.fn().mockResolvedValue(undefined);
  const supabaseResetPasswordOrProvision = jest.fn().mockResolvedValue(undefined);
  const supabaseRevokeSessions = jest.fn().mockResolvedValue(2);

  const tx = {
    membership: {
      findFirst: membershipFindFirst,
      findMany: membershipFindMany,
      count: membershipCount,
      create: membershipCreate,
      update: membershipUpdate,
    },
    user: { create: userCreate, update: userUpdate },
    role: { findUnique: roleFindUnique },
    technicianProfile: { upsert: profileUpsert, update: profileUpdate },
  };

  const db = { current: () => tx } as unknown as TenantPrismaService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const supabase = {
    createUser: supabaseCreateUser,
    resetPassword: supabaseResetPassword,
    resetPasswordOrProvision: supabaseResetPasswordOrProvision,
    revokeUserSessions: supabaseRevokeSessions,
    ...overrides.supabase,
  } as unknown as SupabaseAuthAdminClient;

  return {
    service: new UsersService(db, audit, supabase),
    membershipFindFirst,
    membershipFindMany,
    membershipCount,
    roleFindUnique,
    userCreate,
    userUpdate,
    membershipUpdate,
    supabaseCreateUser,
    supabaseResetPassword,
    supabaseResetPasswordOrProvision,
    supabaseRevokeSessions,
    audit,
  };
}

function expectCode(promise: Promise<unknown>, code: string) {
  return expect(promise).rejects.toMatchObject({ response: { error: { code } } });
}

describe('UsersService — aislamiento (users es tabla global SIN RLS)', () => {
  it('getById de un usuario sin membership en el tenant → 404 NOT_FOUND (R40)', async () => {
    const { service, membershipFindFirst } = buildService();
    membershipFindFirst.mockResolvedValue(null);
    await expectCode(service.getById('u-de-otro-tenant'), 'NOT_FOUND');
  });

  it('getById devuelve el usuario con membership + rol y CUMPLE UserWithMembershipSchema', async () => {
    const { service, membershipFindFirst } = buildService();
    membershipFindFirst.mockResolvedValue(MEMBER_ROW);
    const result = await service.getById('b0000000-0000-4000-8000-000000000001');
    expect(result.roleKey).toBe('technician');
    expect(() => UserWithMembershipSchema.parse(result)).not.toThrow();
  });

  it('list usa memberships (nunca users directo) y devuelve meta de paginación', async () => {
    const { service, membershipFindMany, membershipCount } = buildService();
    membershipFindMany.mockResolvedValue([MEMBER_ROW]);
    membershipCount.mockResolvedValue(1);
    const { data, meta } = await service.list({ limit: 20 });
    expect(membershipFindMany).toHaveBeenCalled();
    expect(data[0]?.id).toBe(UID);
    expect(meta.hasMore).toBe(false);
  });
});

describe('UsersService.create', () => {
  it('rol de operario: valida rol, genera PIN y crea la cuenta en Supabase', async () => {
    const { service, roleFindUnique, membershipFindFirst, supabaseCreateUser } = buildService();
    roleFindUnique.mockResolvedValue({ id: RID, key: 'technician', name: 'Operario' });
    membershipFindFirst.mockResolvedValue(MEMBER_ROW);

    const result = await service.create(
      {
        fullName: 'Nuevo',
        username: 'nuevo.op',
        roleId: RID,
        technicianProfile: {
          licenseType: 'SANITARY_BOOK' as LicenseType,
          licenseNumber: 'LS-000',
          licenseExpiresAt: null,
        },
      },
      ACTOR,
    );

    const pinMatcher = expect.stringMatching(/^\d{6}$/) as unknown;
    expect(supabaseCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'nuevo.op@fumibug.internal',
        temporaryPin: pinMatcher,
      }),
    );
    expect(result.user.roleKey).toBe('technician');
    expect(result.temporaryPin).toMatch(/^\d{6}$/);
  });

  it('rol de oficina (email): NO genera PIN ni toca Supabase', async () => {
    const { service, roleFindUnique, membershipFindFirst, supabaseCreateUser } = buildService();
    roleFindUnique.mockResolvedValue({ id: RID, key: 'office', name: 'Oficina' });
    membershipFindFirst.mockResolvedValue({
      ...MEMBER_ROW,
      role: { id: RID, key: 'office', name: 'Oficina' },
    });

    const result = await service.create(
      { email: 'secretaria@fumibug.dev', fullName: 'Secretaria', roleId: RID },
      ACTOR,
    );
    expect(supabaseCreateUser).not.toHaveBeenCalled();
    expect(result.temporaryPin).toBeUndefined();
  });

  it('rol de operario sin technicianProfile → VALIDATION_ERROR', async () => {
    const { service, roleFindUnique } = buildService();
    roleFindUnique.mockResolvedValue({ id: RID, key: 'technician', name: 'Operario' });
    await expectCode(
      service.create({ fullName: 'Sin perfil', username: 'sinperfil', roleId: RID }, ACTOR),
      'VALIDATION_ERROR',
    );
  });
});

describe('UsersService.update — If-Match', () => {
  it('If-Match no coincide → VERSION_CONFLICT', async () => {
    const { service, membershipFindFirst } = buildService();
    membershipFindFirst.mockResolvedValue(MEMBER_ROW);
    await expectCode(service.update(UID, { fullName: 'X' }, '"etag-viejo"'), 'VERSION_CONFLICT');
  });

  it('If-Match correcto edita sin tocar rol ni email', async () => {
    const { service, membershipFindFirst, userUpdate } = buildService();
    const expected = `"${NOW.toISOString()}"`;
    membershipFindFirst
      .mockResolvedValueOnce(MEMBER_ROW)
      .mockResolvedValueOnce({ ...MEMBER_ROW, user: { ...MEMBER_ROW.user, fullName: 'Nuevo Nombre' } });

    const result = await service.update(UID, { fullName: 'Nuevo Nombre' }, expected);
    expect(result.fullName).toBe('Nuevo Nombre');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { fullName: 'Nuevo Nombre' } }),
    );
  });
});

describe('UsersService.resetPin / forceLogout', () => {
  it('reset-pin genera un PIN de 6 dígitos y lo setea en Supabase (o provisiona la cuenta si nunca existió)', async () => {
    const { service, membershipFindFirst, supabaseResetPasswordOrProvision } = buildService();
    membershipFindFirst.mockResolvedValue(MEMBER_ROW);
    const result = await service.resetPin(UID);
    expect(result.temporaryPin).toMatch(/^\d{6}$/);
    expect(supabaseResetPasswordOrProvision).toHaveBeenCalledWith(UID, result.temporaryPin, 'diego@fumibug.internal');
  });

  it('force-logout revoca sesiones en Supabase y devuelve la cantidad', async () => {
    const { service, membershipFindFirst } = buildService();
    membershipFindFirst.mockResolvedValue(MEMBER_ROW);
    const result = await service.forceLogout(UID);
    expect(result.revokedSessions).toBe(2);
  });

  it('reset-pin de usuario inexistente → 404 sin tocar Supabase', async () => {
    const { service, membershipFindFirst, supabaseResetPasswordOrProvision } = buildService();
    membershipFindFirst.mockResolvedValue(null);
    await expectCode(service.resetPin('u-x'), 'NOT_FOUND');
    expect(supabaseResetPasswordOrProvision).not.toHaveBeenCalled();
  });
});

describe('UsersService.setActive', () => {
  it('desactiva: isActive=false y membership SUSPENDED', async () => {
    const { service, membershipFindFirst, userUpdate, membershipUpdate } = buildService();
    membershipFindFirst
      .mockResolvedValueOnce(MEMBER_ROW)
      .mockResolvedValueOnce({ ...MEMBER_ROW, user: { ...MEMBER_ROW.user, isActive: false } });
    const result = await service.setActive(UID, false, ACTOR);
    expect(result.isActive).toBe(false);
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
    expect(membershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'SUSPENDED' } }),
    );
  });
});


