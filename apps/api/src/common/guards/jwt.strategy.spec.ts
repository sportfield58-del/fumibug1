import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { Env } from '../../config/env.module';
import { JwtStrategy } from './jwt.strategy';

/**
 * Verificación JWT REAL (§K.1): par ES256 efímero + JWKS servido por un http server
 * local. Ejercita el mismo camino de producción (createRemoteJWKSet → jwtVerify con
 * issuer/audiencia) sin depender de Supabase.
 */
/** Tipo de clave que acepta jose para firmar (CryptoKey/KeyObject según runtime). */
type SigningKey = Parameters<SignJWT['sign']>[0];

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let server: Server;
  let baseUrl: string;
  let privateKey: SigningKey;
  let otherPrivateKey: SigningKey;
  let kid: string;

  const CLAIMS = {
    tenant_id: '0f7d2a58-6a55-4c11-b341-9f8c2b7e1001',
    role_key: 'admin',
    permissions: ['customer.read', 'customer.create'],
  };

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256', { extractable: true });
    const other = await generateKeyPair('ES256', { extractable: true });
    privateKey = pair.privateKey;
    otherPrivateKey = other.privateKey;
    const publicJwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: (kid = randomUUID()),
      alg: 'ES256',
      use: 'sig',
    };
    server = createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [publicJwk] }));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}/`;

    const env = {
      NODE_ENV: 'test',
      PORT: 3001,
      APP_DATABASE_URL: 'postgresql://unused',
      SUPABASE_JWKS_URL: `${baseUrl}.well-known/jwks.json`,
      SUPABASE_ISSUER: baseUrl,
    } as Env;

    strategy = new JwtStrategy(env);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function sign(
    key: SigningKey,
    overrides?: {
      claims?: Record<string, unknown>;
      expiresIn?: string;
      audience?: string;
      issuer?: string;
    },
  ): Promise<string> {
    return new SignJWT({ ...CLAIMS, ...overrides?.claims })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setSubject(randomUUID())
      .setIssuedAt()
      .setIssuer(overrides?.issuer ?? baseUrl)
      .setAudience(overrides?.audience ?? 'authenticated')
      .setExpirationTime(overrides?.expiresIn ?? '15m')
      .sign(key);
  }

  /** Extrae error.code del envelope ApiError que producen los guards. */
  async function expectReject(tokenPromise: Promise<string>, code: string): Promise<void> {
    try {
      await strategy.verify(await tokenPromise);
      fail(`debía rechazar con ${code}`);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const response = (err as HttpException).getResponse() as { error?: { code?: string } };
      expect(response.error?.code).toBe(code);
    }
  }

  it('verifica firma/issuer/audiencia y mapea los claims custom', async () => {
    const user = await strategy.verify(await sign(privateKey));
    expect(user.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.tenantId).toBe(CLAIMS.tenant_id);
    expect(user.roleKey).toBe('admin');
    expect(user.permissions).toEqual(CLAIMS.permissions);
    expect(user.email).toBeNull();
  });

  it('mapea email cuando viene en los claims', async () => {
    const user = await strategy.verify(
      await sign(privateKey, { claims: { email: 'carlos@fumibug.dev' } }),
    );
    expect(user.email).toBe('carlos@fumibug.dev');
  });

  it('firma con otra clave → UNAUTHENTICATED', async () => {
    await expectReject(sign(otherPrivateKey), 'UNAUTHENTICATED');
  });

  it('expirado → TOKEN_EXPIRED (el frontend sabe que puede refrescar)', async () => {
    await expectReject(sign(privateKey, { expiresIn: '-10s' }), 'TOKEN_EXPIRED');
  });

  it('audiencia incorrecta → UNAUTHENTICATED', async () => {
    await expectReject(
      sign(privateKey, { audience: 'otra-app' }),
      'UNAUTHENTICATED',
    );
  });

  it('issuer incorrecto → UNAUTHENTICATED', async () => {
    await expectReject(sign(privateKey, { issuer: 'https://malicioso.example/' }), 'UNAUTHENTICATED');
  });

  it('sin claims de tenant → UNAUTHENTICATED (fail closed, §K.2)', async () => {
    await expectReject(
      sign(privateKey, { claims: { tenant_id: undefined } }),
      'UNAUTHENTICATED',
    );
  });

  it('string que no es un JWT → UNAUTHENTICATED', async () => {
    await expectReject(Promise.resolve('no-es-un-jwt'), 'UNAUTHENTICATED');
  });
});
