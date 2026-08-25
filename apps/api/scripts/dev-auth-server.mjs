#!/usr/bin/env node
/**
 * Server de auth para DESARROLLO LOCAL sin Supabase — docs/spec/11-seguridad.md §K.1.
 *
 * Emula lo que Supabase Auth hace en producción:
 *   1. sirve un JWKS (par de claves ES256 generado al vuelo) en
 *      GET /.well-known/jwks.json
 *   2. emite access tokens firmados con ES256 con los claims custom que en prod
 *      inyecta el Custom Access Token Hook (`tenant_id`, `role_key`, `permissions[]`)
 *
 * Uso (dos terminales):
 *   # Terminal 1 — server JWKS + emisor de tokens:
 *   node scripts/dev-auth-server.mjs \
 *     --tenant-id <uuid> --sub <uuid> --email carlos@fumibug.dev \
 *     --role-key admin --permissions customer.read,customer.create
 *   → imprime SUPABASE_JWKS_URL / SUPABASE_ISSUER y un ACCESS_TOKEN
 *
 *   # Terminal 2 — API apuntando a ese JWKS:
 *   SUPABASE_JWKS_URL=http://127.0.0.1:4444/.well-known/jwks.json \
 *   SUPABASE_ISSUER=http://127.0.0.1:4444/ pnpm --filter @fumibug/api dev
 *
 *   # Probar:
 *   curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3001/v1/auth/me
 *
 * NUNCA usar esto fuera de desarrollo local: las claves son efímeras y públicas.
 */
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const port = Number(arg('port') ?? 4444);
const issuer = arg('issuer') ?? `http://127.0.0.1:${port}/`;
const audience = arg('audience') ?? 'authenticated';
const sub = arg('sub') ?? randomUUID();
const email = arg('email') ?? 'dev@fumibug.dev';
const tenantId = arg('tenant-id') ?? sub;
const roleKey = arg('role-key') ?? 'admin';
const permissions = (arg('permissions') ?? '').split(',').filter(Boolean);
const expiresIn = arg('expires-in') ?? '8h';

const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
const publicJwk = { ...(await exportJWK(publicKey)), kid: randomUUID(), alg: 'ES256', use: 'sig' };

const token = await new SignJWT({ tenant_id: tenantId, role_key: roleKey, permissions })
  .setProtectedHeader({ alg: 'ES256', kid: publicJwk.kid })
  .setSubject(sub)
  .setIssuedAt()
  .setIssuer(issuer)
  .setAudience(audience)
  .setExpirationTime(expiresIn)
  .sign(privateKey);

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ keys: [publicJwk] }));
});
server.listen(port, () => {
  process.stdout.write(
    [
      '',
      '── fumibug dev-auth-server ─────────────────────────────────',
      `JWKS     GET ${issuer}.well-known/jwks.json`,
      '',
      '# Variables para la API:',
      `export SUPABASE_JWKS_URL=${issuer}.well-known/jwks.json`,
      `export SUPABASE_ISSUER=${issuer}`,
      '',
      '# Access token:',
      `export ACCESS_TOKEN=${token}`,
      '',
      `# Claims: sub=${sub} tenant=${tenantId} role=${roleKey}`,
      `#         permissions=[${permissions.join(', ')}] exp=${expiresIn}`,
      '─────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
});
