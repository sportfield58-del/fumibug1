import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

/** jose usa el tipo global CryptoKey (Web Crypto) — sin lib "dom", TS no lo conoce acá.
 * Se infiere del propio retorno de generateKeyPair en vez de agregar todo el lib DOM. */
type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

/**
 * Versión programática de scripts/dev-auth-server.mjs — mismo principio (JWKS +
 * firma ES256 emulando el Custom Access Token Hook de Supabase, §K.1), pero como
 * server efímero embebido en el proceso de test en vez de un CLI aparte, para poder
 * emitir tokens de varios tenants/usuarios dentro del mismo test.
 */
export interface TestTokenClaims {
  sub: string;
  tenantId: string;
  roleKey: string;
  permissions: string[];
  email?: string | null;
}

export class JwtTestIssuer {
  private constructor(
    private readonly server: Server,
    private readonly privateKey: PrivateKey,
    private readonly kid: string,
    readonly jwksUrl: string,
    readonly issuer: string,
    readonly audience: string,
  ) {}

  static async start(): Promise<JwtTestIssuer> {
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
    const kid = randomUUID();
    const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };

    const server = createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [publicJwk] }));
    });

    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          throw new Error('No se pudo levantar el server de JWKS de test.');
        }
        resolve(address.port);
      });
    });

    const issuer = `http://127.0.0.1:${port}/`;
    return new JwtTestIssuer(server, privateKey, kid, `${issuer}.well-known/jwks.json`, issuer, 'authenticated');
  }

  async issue(claims: TestTokenClaims, expiresIn = '1h'): Promise<string> {
    return new SignJWT({
      tenant_id: claims.tenantId,
      role_key: claims.roleKey,
      permissions: claims.permissions,
      email: claims.email ?? null,
    })
      .setProtectedHeader({ alg: 'ES256', kid: this.kid })
      .setSubject(claims.sub)
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setExpirationTime(expiresIn)
      .sign(this.privateKey);
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
