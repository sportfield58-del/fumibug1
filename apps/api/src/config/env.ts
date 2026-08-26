import { z } from 'zod';

/**
 * Variables de entorno de apps/api, validadas con Zod al boot (fail-fast).
 *
 * docs/spec/11-seguridad.md §K.8: `.env.example` lista todas las claves sin valores
 * reales; los secretos viven en Railway/GitHub Secrets. Acá no se leen secretos:
 * solo configuración de conexión.
 *
 * - APP_DATABASE_URL conecta como rol `fumibug_app` (sin BYPASSRLS): es lo que hace
 *   real la Capa 2 del aislamiento (§K.4). DATABASE_URL (rol migrador) NO se usa en
 *   runtime de la API, por eso ni aparece acá.
 * - SUPABASE_* configura la verificación de JWT (§K.1). En desarrollo local sin
 *   Supabase se puede apuntar SUPABASE_JWKS_URL y SUPABASE_ISSUER al server de
 *   `scripts/dev-auth-server.mjs`.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_ISSUER: z.string().url().optional(),
  /** docs/spec/15-escalabilidad.md §R.2. Sin esto, Sentry queda en no-op (ver observability/sentry.ts). */
  SENTRY_DSN: z.string().url().optional(),
  /** CSV de orígenes permitidos — docs/spec/11-seguridad.md §K.9: "allowlist explícita, no *". */
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** URL del JWKS de Supabase (o del server de dev). Falla con mensaje accionable. */
export function resolveJwksUrl(env: Env): string {
  if (env.SUPABASE_JWKS_URL) return env.SUPABASE_JWKS_URL;
  if (env.SUPABASE_URL) return `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  throw new Error(
    'SUPABASE_JWKS_URL o SUPABASE_URL son requeridas para verificar JWTs ' +
      '(docs/spec/11-seguridad.md §K.1). Para desarrollo local sin Supabase, ver ' +
      'apps/api/scripts/dev-auth-server.mjs.',
  );
}

/** Emisor esperado en el claim `iss` de los tokens de Supabase Auth. */
export function resolveIssuer(env: Env): string {
  if (env.SUPABASE_ISSUER) return env.SUPABASE_ISSUER;
  if (env.SUPABASE_URL) return `${env.SUPABASE_URL}/auth/v1`;
  return resolveJwksUrl(env);
}

/** Orígenes CORS permitidos. Vacío en dev (Nest deja pasar same-origin/no-origin de todos modos). */
export function resolveCorsOrigins(env: Env): string[] {
  if (!env.CORS_ALLOWED_ORIGINS) return [];
  return env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Variables de entorno inválidas:\n  - ${issues.join('\n  - ')}`);
  }
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`),
    );
  }
  return parsed.data;
}
