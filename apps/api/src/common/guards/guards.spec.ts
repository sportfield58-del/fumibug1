import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@fumibug/contracts';
import type { Request } from 'express';
import { JwtGuard } from './jwt.guard';
import { TenantGuard } from './tenant.guard';
import { PermissionGuard, resolveReadScope } from './permission.guard';
import { RequestContextService } from '../tenant/request-context.service';
import { httpApiError } from '../http/api-response';

/**
 * Guards sin Nest completo: Reflector real (sin metadata → no público), strategy
 * stub y el RequestContextService real para validar el contrato de escritura en el
 * contexto compartido.
 */
describe('JwtGuard y TenantGuard', () => {
  const USER = {
    userId: 'u-1',
    email: null,
    tenantId: 't-1',
    roleKey: 'admin',
    permissions: ['customer.read'] as PermissionKey[],
  };

  let context: RequestContextService;
  let reflector: Reflector;
  let req: Request;

  function execContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: <T>() => req as unknown as T,
        getResponse: <T>() => ({}) as unknown as T,
        getNext: () => undefined,
      }),
      getHandler: () => jest.fn(),
      getClass: () => class {},
      getType: () => 'http',
      getArgs: () => [],
      getArgByIndex: () => undefined,
      switchToWs: () => ({ getClient: () => undefined, getData: () => undefined }),
      switchToRpc: () => ({ getContext: () => undefined, getData: () => undefined }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    context = new RequestContextService();
    reflector = new Reflector();
    req = { headers: {} } as unknown as Request;
  });

  describe('JwtGuard', () => {
    function guard(strategy: { verify: (token: string) => Promise<typeof USER> }): JwtGuard {
      return new JwtGuard(reflector, strategy as never, context);
    }

    it('ruta @Public pasa sin llamar a la strategy', async () => {
      const verify = jest.fn();
      reflector.getAllAndOverride = jest.fn().mockReturnValue(true);
      const ok = await guard({ verify }).canActivate(execContext());
      expect(ok).toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });

    it('sin header Authorization → 401 UNAUTHENTICATED con envelope del contrato', async () => {
      await context.run({ requestId: 'req-42' }, async () => {
        try {
          await guard({ verify: jest.fn() }).canActivate(execContext());
          fail('debía rechazar');
        } catch (err) {
          const body = (err as { response?: { error?: { code?: string }; requestId?: string } })
            .response;
          expect(body?.error?.code).toBe('UNAUTHENTICATED');
          expect(body?.requestId).toBe('req-42');
        }
      });
    });

    it('header válido publica el usuario en req y en el contexto', async () => {
      req.headers['authorization'] = `Bearer token-de-prueba`;
      await context.run({ requestId: 'r' }, async () => {
        const ok = await guard({ verify: jest.fn().mockResolvedValue(USER) }).canActivate(
          execContext(),
        );
        expect(ok).toBe(true);
        expect(req.user).toEqual(USER);
        expect(context.get().user).toEqual(USER);
      });
    });

    it('propaga el error de la strategy (TOKEN_EXPIRED, etc.)', async () => {
      req.headers['authorization'] = 'Bearer expirado';
      await context.run({ requestId: 'r' }, async () => {
        await expect(
          guard({
            verify: () =>
              Promise.reject(httpApiError('TOKEN_EXPIRED', 'expiró', 401)) as never,
          }).canActivate(execContext()),
        ).rejects.toMatchObject({
          response: { error: { code: 'TOKEN_EXPIRED' } },
        });
      });
    });
  });

  describe('TenantGuard', () => {
    function guard(): TenantGuard {
      return new TenantGuard(reflector, context);
    }

    it('ruta @Public pasa sin exigir user', () => {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(true);
      expect(guard().canActivate(execContext())).toBe(true);
    });

    it('sin user en contexto lanza (JwtGuard no corrió: bug de orden)', () => {
      expect(() =>
        context.run({ requestId: 'r' }, () => guard().canActivate(execContext())),
      ).toThrow(/JwtGuard/);
    });

    it('fija tenantId desde los claims verificados', () => {
      req.headers['authorization'] = 'Bearer x';
      context.run(
        {
          requestId: 'r',
          user: USER,
        },
        () => {
          expect(guard().canActivate(execContext())).toBe(true);
          expect(req.tenantId).toBe('t-1');
          expect(context.get().tenantId).toBe('t-1');
        },
      );
    });
  });

  describe('PermissionGuard', () => {
    function guard(): PermissionGuard {
      return new PermissionGuard(reflector, context);
    }

    it('ruta @Public pasa sin exigir user ni metadata de permiso', () => {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(true);
      expect(guard().canActivate(execContext())).toBe(true);
    });

    it('sin @RequirePermission en el handler, deja pasar (GET /auth/me, etc.)', () => {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);
      context.run({ requestId: 'r', user: USER }, () => {
        expect(guard().canActivate(execContext())).toBe(true);
      });
    });

    it('con el permiso requerido, pasa', () => {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(['customer.read']);
      context.run({ requestId: 'r', user: USER }, () => {
        expect(guard().canActivate(execContext())).toBe(true);
      });
    });

    it('sin el permiso requerido, 403 FORBIDDEN con el envelope del contrato', () => {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(['route.publish']);
      context.run({ requestId: 'req-9', user: USER }, () => {
        try {
          guard().canActivate(execContext());
          fail('debía rechazar');
        } catch (err) {
          const body = (err as { response?: { error?: { code?: string }; requestId?: string } })
            .response;
          expect(body?.error?.code).toBe('FORBIDDEN');
          expect(body?.requestId).toBe('req-9');
        }
      });
    });

    it('con varias keys (patrón own/tenant), alcanza con tener una', () => {
      reflector.getAllAndOverride = jest
        .fn()
        .mockReturnValue(['service.read.own', 'service.read.tenant']);
      context.run(
        { requestId: 'r', user: { ...USER, permissions: ['service.read.own'] } },
        () => {
          expect(guard().canActivate(execContext())).toBe(true);
        },
      );
    });

    it('sin user en contexto lanza (orden de guards violado)', () => {
      reflector.getAllAndOverride = jest.fn().mockReturnValue(['customer.read']);
      expect(() =>
        context.run({ requestId: 'r' }, () => guard().canActivate(execContext())),
      ).toThrow(/JwtGuard/);
    });
  });

  describe('resolveReadScope', () => {
    const OWN = 'service.read.own' as const;
    const TENANT = 'service.read.tenant' as const;

    it('devuelve tenant si el usuario tiene ambas keys (gana el scope más amplio)', () => {
      const user = { ...USER, permissions: [OWN, TENANT] };
      expect(resolveReadScope(user, OWN, TENANT)).toBe('tenant');
    });

    it('devuelve own si solo tiene la key own', () => {
      const user = { ...USER, permissions: [OWN] };
      expect(resolveReadScope(user, OWN, TENANT)).toBe('own');
    });

    it('devuelve null si no tiene ninguna', () => {
      const user = { ...USER, permissions: [] };
      expect(resolveReadScope(user, OWN, TENANT)).toBeNull();
    });
  });
});
