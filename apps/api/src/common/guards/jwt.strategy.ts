import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors, type JWTPayload } from 'jose';
import { z } from 'zod';
import { PermissionKeySchema } from '@fumibug/contracts';
import { resolveIssuer, resolveJwksUrl } from '../../config/env';
import { ENV, type Env } from '../../config/env.module';
import { httpApiError } from '../http/api-response';
import type { RequestUser } from '../tenant/request-context';

/**
 * Verificación de JWT de Supabase Auth — docs/spec/11-seguridad.md §K.1.
 *
 * El token se verifica por JWKS (claves públicas, cacheadas por `jose` con
 * re-fetch cooldown): sin llamada a Supabase por request. Los claims custom
 * (`tenant_id`, `role_key`, `permissions[]`) los inyecta el Auth Hook de Supabase
 * al emitir el token; si faltan, el token no sirve — fail closed.
 */

/** Audiencia estándar de access tokens de Supabase Auth. */
export const AUTH_AUDIENCE = 'authenticated';

const AccessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().nullish(),
  tenant_id: z.string().uuid(),
  role_key: z.string().min(1),
  // Validado contra el catálogo de contracts: un permiso desconocido en el token
  // significa hook desactualizado o token manipulado — fail closed.
  permissions: z.array(PermissionKeySchema),
});

@Injectable()
export class JwtStrategy {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async verify(token: string): Promise<RequestUser> {
    try {
      const { payload } = await jwtVerify(token, this.remoteJwks(), {
        issuer: resolveIssuer(this.env),
        audience: AUTH_AUDIENCE,
      });
      return mapClaims(payload);
    } catch (err) {
      throw toAuthException(err);
    }
  }

  /**
   * Lazy + singleton: createRemoteJWKSet cachea claves y refresca ante kid desconocido
   * (cooldown de 5 min evita martillar el endpoint si un token viene roto).
   */
  private remoteJwks(): ReturnType<typeof createRemoteJWKSet> {
    this.jwks ??= createRemoteJWKSet(new URL(resolveJwksUrl(this.env)), {
      cooldownDuration: 300_000,
    });
    return this.jwks;
  }
}

function mapClaims(payload: JWTPayload): RequestUser {
  const parsed = AccessTokenClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw httpApiError(
      'UNAUTHENTICATED',
      'El token no trae los claims requeridos (tenant_id, role_key, permissions). ' +
        'Verificar el Custom Access Token Hook de Supabase.',
      401,
    );
  }
  return {
    userId: parsed.data.sub,
    email: parsed.data.email ?? null,
    tenantId: parsed.data.tenant_id,
    roleKey: parsed.data.role_key,
    permissions: parsed.data.permissions,
  };
}

function toAuthException(err: unknown) {
  if (err instanceof joseErrors.JWTExpired) {
    // Código diferenciado para que el frontend sepa que puede refrescar sin
    // re-login (docs/spec/10-api.md §J.1: TOKEN_EXPIRED).
    return httpApiError('TOKEN_EXPIRED', 'El token expiró. Refrescá la sesión.', 401);
  }
  if (err instanceof Error && err.name === 'HttpException') {
    // Errores de mapeo de claims ya vienen como HttpException tipada.
    throw err;
  }
  return httpApiError(
    'UNAUTHENTICATED',
    'Token inválido o no verificable contra el JWKS del proveedor de identidad.',
    401,
  );
}
