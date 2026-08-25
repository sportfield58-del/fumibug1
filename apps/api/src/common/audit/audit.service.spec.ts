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
});
