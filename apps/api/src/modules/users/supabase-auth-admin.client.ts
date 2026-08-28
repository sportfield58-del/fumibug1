import { Inject, Injectable, Logger } from '@nestjs/common';
import { httpApiError } from '../../common/http/api-response';
import { ENV, type Env } from '../../config/env.module';

/**
 * Cliente admin de Supabase Auth (GoTrueAdminAPI) — docs/spec/11-seguridad.md §K.1.
 *
 * Es el ÚNICO punto que toca el sistema de identidad externo (auth.users). Los flujos
 * que dependen de crear/resetear la cuenta de Supabase de un operario o de revocar sus
 * sesiones (createUser de operario, reset-pin, force-logout) pasan por acá.
 *
 * Requiere `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (env). Si no están configuradas,
 * lanza un error accionable en vez de fallar silenciosamente — así un operario dado de
 * alta sin Supabase no queda con una cuenta inexistente a medias.
 *
 * Se inyecta en UsersService; en tests se mockea este provider para no depender de un
 * Supabase real ni de credenciales de CI.
 */
@Injectable()
export class SupabaseAuthAdminClient {
  private readonly logger = new Logger(SupabaseAuthAdminClient.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Crea la cuenta de Supabase + password provisorio. Devuelve el auth id (== user.id). */
  async createUser(input: {
    email?: string;
    username?: string;
    temporaryPin: string;
  }): Promise<void> {
    const cfg = this.requireConfig();
    const email =
      input.email ?? (input.username ? `${input.username}@${cfg.internalDomain}` : undefined);
    if (!email) {
      throw httpApiError(
        'BUSINESS_RULE_VIOLATION',
        'No se pudo determinar el email de Supabase del usuario.',
        422,
      );
    }

    await this.request(cfg, '/auth/v1/admin/users', 'POST', {
      email,
      password: input.temporaryPin,
      email_confirm: true,
    });
  }

  /** Setea una password provisoria (PIN de 6 dígitos) en Supabase. */
  async resetPassword(userId: string, temporaryPin: string): Promise<void> {
    const cfg = this.requireConfig();
    await this.request(cfg, `/auth/v1/admin/users/${userId}`, 'PUT', {
      password: temporaryPin,
    });
  }

  /**
   * Resetea el PIN si la cuenta de Supabase ya existe; si no (ej. un operario
   * sembrado directo en Postgres por `seed.ts`, que nunca pasó por `createUser`),
   * la crea con ese mismo id — necesario porque `JwtStrategy` usa el `sub` del JWT
   * como `user.id` tal cual (docs/spec/11-seguridad.md §K.1), así que la cuenta de
   * Supabase y la fila de negocio tienen que compartir id siempre.
   */
  async resetPasswordOrProvision(userId: string, temporaryPin: string, email: string): Promise<void> {
    const cfg = this.requireConfig();
    const res = await fetch(`${cfg.baseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: this.headers(cfg),
      body: JSON.stringify({ password: temporaryPin }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return;
    if (res.status !== 404) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Supabase Auth Admin PUT /admin/users/${userId} → ${res.status}: ${text}`);
      throw httpApiError('INTERNAL_ERROR', 'No se pudo resetear el PIN en Supabase Auth. Reintentá o contactá soporte.', 502);
    }
    // 404: nunca se creó la cuenta (operario sembrado directo en la DB) — la creamos ahora, con el mismo id.
    await this.request(cfg, '/auth/v1/admin/users', 'POST', {
      id: userId,
      email,
      password: temporaryPin,
      email_confirm: true,
    });
  }

  /** Devuelve la cantidad de refresh tokens activos del usuario en Supabase Auth. */
  async listSessions(userId: string): Promise<number> {
    const cfg = this.requireConfig();
    const res = await fetch(`${cfg.baseUrl}/auth/v1/admin/sessions${this.qs(userId)}`, {
      headers: this.headers(cfg),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.warn(`listSessions falló (${res.status}): ${await res.text()}`);
      return 0;
    }
    const body = (await res.json()) as { sessions?: unknown[] };
    return Array.isArray(body.sessions) ? body.sessions.length : 0;
  }

  /** Revoca todas las sesiones activas del usuario en Supabase Auth. */
  async revokeUserSessions(userId: string): Promise<number> {
    const cfg = this.requireConfig();
    const count = await this.listSessions(userId);
    if (count > 0) {
      await this.request(cfg, `/auth/v1/admin/users/${userId}/sessions`, 'DELETE');
    }
    return count;
  }

  private requireConfig(): {
    baseUrl: string;
    serviceRoleKey: string;
    internalDomain: string;
  } {
    if (!this.env.SUPABASE_URL || !this.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw httpApiError(
        'INTERNAL_ERROR',
        'Supabase Auth Admin no está configurado (falta SUPABASE_SERVICE_ROLE_KEY). ' +
          'No se puede crear/resetear la cuenta del operario ni revocar sesiones.',
        500,
      );
    }
    return {
      baseUrl: this.env.SUPABASE_URL,
      serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      internalDomain: 'fumibug.internal',
    };
  }

  private headers(cfg: { serviceRoleKey: string }): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
    };
  }

  private qs(userId: string): string {
    return `?user_id=${encodeURIComponent(userId)}`;
  }

  private async request(
    cfg: { baseUrl: string; serviceRoleKey: string },
    path: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
  ): Promise<void> {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method,
      headers: this.headers(cfg),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Supabase Auth Admin ${method} ${path} → ${res.status}: ${text}`);
      throw httpApiError(
        'INTERNAL_ERROR',
        'No se pudo operar la cuenta en Supabase Auth. Reintentá o contactá soporte.',
        502,
      );
    }
  }
}
