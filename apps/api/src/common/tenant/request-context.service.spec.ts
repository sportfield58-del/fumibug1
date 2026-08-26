import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('expone el contexto dentro de run()', () => {
    service.run({ requestId: 'req-1' }, () => {
      expect(service.get().requestId).toBe('req-1');
    });
  });

  it('get() lanza fuera de run() (middleware ausente es un bug de wiring)', () => {
    expect(() => service.get()).toThrow(/No hay RequestContext/);
  });

  it('requestIdOrDefault() genera uno fuera de request (errores tempranos)', () => {
    const id = service.requestIdOrDefault();
    expect(id).toMatch(/[0-9a-f-]{36}/);
  });

  it('requireUser() exige que JwtGuard haya corrido antes', () => {
    // Fuera de run(): el problema es el middleware, no el guard.
    expect(() => service.requireUser()).toThrow(/RequestContext/);
    // Dentro de run() pero sin user: JwtGuard no corrió.
    expect(() =>
      service.run({ requestId: 'r' }, () => service.requireUser()),
    ).toThrow(/JwtGuard/);
    service.run(
      {
        requestId: 'r',
        user: { userId: 'u1', email: null, tenantId: 't1', roleKey: 'admin', permissions: [] },
      },
      () => {
        expect(service.requireUser().userId).toBe('u1');
      },
    );
  });

  it('requireTenantId() exige que TenantGuard haya corrido antes', () => {
    expect(() => service.run({ requestId: 'r' }, () => service.requireTenantId())).toThrow(
      /tenantId/,
    );
    service.run({ requestId: 'r', tenantId: 't1' }, () => {
      expect(service.requireTenantId()).toBe('t1');
    });
  });
});
