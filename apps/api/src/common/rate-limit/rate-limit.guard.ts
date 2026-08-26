import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { httpApiError } from '../http/api-response';

/**
 * Rate limiting en memoria — docs/spec/11-seguridad.md §K.6: "MVP con almacenamiento en
 * memoria (una sola instancia). Al pasar a 2+ instancias, migrar a Redis — es el primer
 * disparador real de Redis (§R.4)."
 *
 * Ventana fija simple, sin dependencias externas: alcanza para una instancia y es
 * trivial de reemplazar por un store de Redis con la misma interfaz `RateLimitStore`
 * el día que haga falta — nada del resto del código cambia.
 */
export interface RateLimitConfig {
  windowMs: number;
  limit: number;
}

export interface RateLimitStore {
  hit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number };
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, { windowMs, limit }: RateLimitConfig): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }
    bucket.count += 1;
    return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count) };
  }
}

// Límites de docs/spec/11-seguridad.md §K.6.
export const GLOBAL_AUTHENTICATED_LIMIT: RateLimitConfig = { windowMs: 60_000, limit: 300 };
export const GLOBAL_ANONYMOUS_LIMIT: RateLimitConfig = { windowMs: 60_000, limit: 60 };

// Presets documentados para cuando existan esos endpoints — ninguno se aplica todavía
// en Fase 0 porque ninguno de estos endpoints existe. Quedan listos para que Fase 1
// los use con @RateLimit(...) en el momento de construir cada uno.
export const AUTH_LOGIN_LIMIT: RateLimitConfig = { windowMs: 15 * 60_000, limit: 5 };
export const PASSWORD_RESET_LIMIT: RateLimitConfig = { windowMs: 60 * 60_000, limit: 3 };
export const PUBLIC_VERIFY_LIMIT: RateLimitConfig = { windowMs: 60_000, limit: 30 };
export const FIELD_SYNC_LIMIT: RateLimitConfig = { windowMs: 60_000, limit: 60 };

export const RATE_LIMIT_KEY = 'fumibug:rate-limit';

/** Override por endpoint. Sin este decorador, se aplica el límite global (own/tenant §K.6). */
export const RateLimit = (config: RateLimitConfig): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_KEY, config);

/**
 * Corre después de JwtGuard (necesita saber si hay usuario autenticado para elegir el
 * límite) y antes de TenantGuard/PermissionGuard (cortar temprano ante abuso). El
 * health check no tiene límite: son probes de infraestructura, no tráfico de negocio.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store: RateLimitStore = new InMemoryRateLimitStore();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.path === '/health') return true;

    const override = this.reflector.getAllAndOverride<RateLimitConfig | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const config = override ?? (req.user ? GLOBAL_AUTHENTICATED_LIMIT : GLOBAL_ANONYMOUS_LIMIT);
    const key = `${req.path}:${req.user?.userId ?? req.ip}`;

    const { allowed } = this.store.hit(key, config);
    if (!allowed) {
      throw httpApiError('RATE_LIMITED', 'Demasiadas solicitudes. Reintentá en unos segundos.', 429);
    }
    return true;
  }
}
