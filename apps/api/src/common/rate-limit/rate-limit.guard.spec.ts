import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RateLimitGuard, RATE_LIMIT_KEY } from './rate-limit.guard';

function execContext(req: Partial<Request>): ExecutionContext {
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

describe('RateLimitGuard', () => {
  let reflector: Reflector;
  let getAllAndOverride: jest.Mock;
  let guard: RateLimitGuard;

  beforeEach(() => {
    reflector = new Reflector();
    getAllAndOverride = jest.fn().mockReturnValue(undefined);
    reflector.getAllAndOverride = getAllAndOverride;
    guard = new RateLimitGuard(reflector);
  });

  it('/health nunca tiene límite', () => {
    for (let i = 0; i < 1000; i++) {
      expect(guard.canActivate(execContext({ path: '/health', ip: '1.1.1.1' }))).toBe(true);
    }
  });

  it('anónimo: bloquea después del límite global (60/min) para la misma IP+ruta', () => {
    const req = { path: '/v1/ping', ip: '2.2.2.2' } as Request;
    for (let i = 0; i < 60; i++) {
      expect(guard.canActivate(execContext(req))).toBe(true);
    }
    try {
      guard.canActivate(execContext(req));
      fail('debía rechazar');
    } catch (err) {
      const body = (err as { response?: { error?: { code?: string } } }).response;
      expect(body?.error?.code).toBe('RATE_LIMITED');
    }
  });

  it('IPs distintas no comparten balde', () => {
    const req1 = { path: '/v1/ping', ip: '3.3.3.3' } as Request;
    const req2 = { path: '/v1/ping', ip: '4.4.4.4' } as Request;
    for (let i = 0; i < 60; i++) guard.canActivate(execContext(req1));
    expect(guard.canActivate(execContext(req2))).toBe(true);
  });

  it('autenticado: usa userId como key y el límite de 300/min, no el de IP', () => {
    const req = {
      path: '/v1/ping',
      ip: '5.5.5.5',
      user: { userId: 'u-limit-test', tenantId: 't', roleKey: 'owner', permissions: [], email: null },
    } as unknown as Request;
    for (let i = 0; i < 61; i++) {
      expect(guard.canActivate(execContext(req))).toBe(true);
    }
  });

  it('respeta el override de @RateLimit(...) por endpoint', () => {
    getAllAndOverride.mockReturnValue({ windowMs: 60_000, limit: 2 });
    const req = { path: '/v1/auth/login', ip: '6.6.6.6' } as Request;
    expect(guard.canActivate(execContext(req))).toBe(true);
    expect(guard.canActivate(execContext(req))).toBe(true);
    expect(() => guard.canActivate(execContext(req))).toThrow();
    expect(getAllAndOverride).toHaveBeenCalledWith(RATE_LIMIT_KEY, expect.any(Array));
  });
});
