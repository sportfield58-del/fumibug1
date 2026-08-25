import { StateMachineService } from './state-machine.service';
import type { TenantPrismaService } from '../tenant/tenant-prisma.service';

describe('StateMachineService', () => {
  let queryRaw: jest.Mock;
  let executeRaw: jest.Mock;
  let db: { current: jest.Mock };
  let service: StateMachineService;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([{ status: 'DRAFT' }]);
    executeRaw = jest.fn().mockResolvedValue(1);
    db = { current: jest.fn().mockReturnValue({ $queryRaw: queryRaw, $executeRaw: executeRaw }) };
    service = new StateMachineService(db as unknown as TenantPrismaService);
  });

  it('rechaza una transición no permitida SIN pegarle a la base (§D.8)', async () => {
    await expect(
      service.transition({
        entity: 'service',
        id: 'x',
        from: 'DRAFT',
        to: 'COMPLETED', // no está en la tabla de docs/spec/04-estados.md §D.3
        actorId: 'u-1',
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'STATE_CONFLICT' } } });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('transición permitida: hace el SELECT ... FOR UPDATE y después el UPDATE', async () => {
    await service.transition({
      entity: 'service',
      id: 'svc-1',
      from: 'DRAFT',
      to: 'SCHEDULED',
      actorId: 'u-1',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('409 STATE_CONFLICT si el estado real en DB no coincide con `from` (carrera concurrente)', async () => {
    queryRaw.mockResolvedValue([{ status: 'CANCELLED' }]); // alguien más ya lo canceló
    await expect(
      service.transition({ entity: 'service', id: 'svc-1', from: 'DRAFT', to: 'SCHEDULED', actorId: 'u-1' }),
    ).rejects.toMatchObject({ response: { error: { code: 'STATE_CONFLICT' } } });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('404 NOT_FOUND si la fila no existe (o no es del tenant — RLS ya filtró)', async () => {
    queryRaw.mockResolvedValue([]);
    await expect(
      service.transition({ entity: 'service', id: 'no-existe', from: 'DRAFT', to: 'SCHEDULED', actorId: 'u-1' }),
    ).rejects.toMatchObject({ response: { error: { code: 'NOT_FOUND' } } });
  });

  it('corre los guards ANTES del lock, y si uno lanza, no llega a tocar la base', async () => {
    const guard = jest.fn(() => {
      throw new Error('guard bloqueó');
    });
    await expect(
      service.transition({
        entity: 'service',
        id: 'svc-1',
        from: 'DRAFT',
        to: 'SCHEDULED',
        actorId: 'u-1',
        guards: [guard],
      }),
    ).rejects.toThrow('guard bloqueó');
    expect(guard).toHaveBeenCalledTimes(1);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('entidades sin version (ej. service_session) no rompen aunque no tengan esa columna', async () => {
    queryRaw.mockResolvedValue([{ status: 'OPEN' }]);
    await expect(
      service.transition({ entity: 'service_session', id: 's-1', from: 'OPEN', to: 'CLOSED', actorId: 'u-1' }),
    ).resolves.toBeUndefined();
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
