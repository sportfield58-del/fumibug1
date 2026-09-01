import { AuditService } from './audit.service';
import { RequestContextService } from '../tenant/request-context.service';
import type { TenantPrismaService } from '../tenant/tenant-prisma.service';

describe('AuditService', () => {
  let context: RequestContextService;
  let auditLogCreate: jest.Mock;
  let db: { current: jest.Mock };
  let service: AuditService;

  beforeEach(() => {
    context = new RequestContextService();
    auditLogCreate = jest.fn().mockResolvedValue({ id: 1n });
    db = { current: jest.fn().mockReturnValue({ auditLog: { create: auditLogCreate } }) };
    service = new AuditService(db as unknown as TenantPrismaService, context);
  });

  it('escribe en la MISMA transacción del request (db.current()), no una propia (§K.10)', async () => {
    await context.run(
      {
        requestId: 'req-1',
        tenantId: 't-1',
        user: { userId: 'u-1', tenantId: 't-1', roleKey: 'admin', permissions: [], email: null },
        ip: '9.9.9.9',
        userAgent: 'jest',
      },
      async () => {
        await service.record({ action: 'ping', entityType: 'system', severity: 'INFO' });
      },
    );

    expect(db.current).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'admin',
        action: 'ping',
        entityType: 'system',
        entityId: undefined,
        before: undefined,
        after: undefined,
        diff: undefined,
        severity: 'INFO',
        ip: '9.9.9.9',
        userAgent: 'jest',
        requestId: 'req-1',
      },
    });
  });

  it('default de severity es INFO', async () => {
    await context.run({ requestId: 'r', tenantId: 't-1' }, async () => {
      await service.record({ action: 'x', entityType: 'y' });
    });
    const call = auditLogCreate.mock.calls[0] as [{ data: { severity: string } }];
    expect(call[0].data.severity).toBe('INFO');
  });

  it('sin tenantId en contexto, lanza (no hay forma de auditar sin tenant)', async () => {
    await expect(
      context.run({ requestId: 'r' }, () => service.record({ action: 'x', entityType: 'y' })),
    ).rejects.toThrow(/tenantId/);
  });

  it('listLogs pagina por cursor y serializa el id BigInt a string', async () => {
    const auditLogFindMany = jest.fn().mockResolvedValue([
      {
        id: 1002n,
        tenantId: 't-1',
        actorUserId: 'u-1',
        actorRole: 'owner',
        action: 'route.publish',
        entityType: 'route',
        entityId: 'e-1',
        before: { status: 'DRAFT' },
        after: { status: 'PUBLISHED' },
        diff: null,
        severity: 'INFO',
        ip: '9.9.9.9',
        userAgent: 'jest',
        requestId: 'req-1',
        createdAt: new Date('2026-08-27T18:00:00.000Z'),
      },
    ]);
    db.current.mockReturnValue({ auditLog: { create: auditLogCreate, findMany: auditLogFindMany } });

    const result = await service.listLogs({ cursor: '1001', limit: 20 });

    expect(auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { lt: 1001n } },
        orderBy: [{ id: 'desc' }],
        take: 20,
      }),
    );
    expect(result[0]).toMatchObject({
      id: '1002',
      actorRole: 'owner',
      action: 'route.publish',
      severity: 'INFO',
      createdAt: '2026-08-27T18:00:00.000Z',
    });
  });

  it('listLogs arma los filtros (entityType, actorUserId, from/to en createdAt)', async () => {
    const auditLogFindMany = jest.fn().mockResolvedValue([]);
    db.current.mockReturnValue({ auditLog: { create: auditLogCreate, findMany: auditLogFindMany } });

    await service.listLogs({
      limit: 20,
      entityType: 'service',
      actorUserId: 'u-9',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.000Z',
    });

    const calls = auditLogFindMany.mock.calls as Array<[{ where: Record<string, unknown> }]>;
    expect(calls).toHaveLength(1);
    const where = calls[0]![0].where;
    expect(where.entityType).toBe('service');
    expect(where.actorUserId).toBe('u-9');
    expect(where.createdAt).toEqual({ gte: new Date('2026-08-01T00:00:00.000Z'), lte: new Date('2026-08-31T23:59:59.000Z') });
  });
});
