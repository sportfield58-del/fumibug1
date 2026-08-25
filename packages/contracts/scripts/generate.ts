/**
 * Genera, desde packages/contracts/src/endpoints.ts (fuente única de verdad, ADR 0005):
 *   - docs/api/openapi.json
 *   - apps/web/lib/api/client.ts   — cliente tipado, "GENERADO, no editar a mano"
 *   - apps/web/mocks/handlers.ts   — handlers de MSW con los `example` de cada endpoint
 *
 * Correr con `pnpm generate` desde la raíz (docs/spec/16-estructura.md §U). Nadie edita
 * a mano los tres archivos de salida — se regeneran cuando cambia un contrato.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ENDPOINTS, type EndpointDef } from '../src/endpoints';
import type { ZodTypeAny } from 'zod';

const ROOT = resolve(__dirname, '../../..');
const OPENAPI_PATH = resolve(ROOT, 'docs/api/openapi.json');
const CLIENT_PATH = resolve(ROOT, 'apps/web/lib/api/client.ts');
const MOCKS_PATH = resolve(ROOT, 'apps/web/mocks/handlers.ts');

/**
 * Los objetos de ENDPOINTS son literales `as const` con schemas de Zod anidados
 * (MeResponseSchema incluye Tenant/User/Membership/el enum de 65 permisos) — TS
 * retiene el genérico completo en cada branch de la unión, y pasar eso a otra función
 * genérica (zodToJsonSchema) o incluso solo leer `.example` dispara "Type instantiation
 * is excessively deep": un límite del compilador combinando tipos recursivos de Zod
 * con inferencia genérica externa, no un error real de tipos. `any` acá es el escape
 * deliberado — el propio endpoints.spec.ts en packages/contracts ya valida cada
 * `example` contra su schema con los tipos completos; este script no repite esa
 * garantía, solo emite archivos a partir de datos ya certificados como válidos.
 */
const ENDPOINT_LIST: any[] = Object.values(ENDPOINTS);

const GENERATED_HEADER = (source: string): string =>
  `// GENERADO por packages/contracts/scripts/generate.ts a partir de ${source}.\n` +
  `// No editar a mano — correr \`pnpm generate\` desde la raíz para regenerar.\n\n`;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function functionName(def: EndpointDef<ZodTypeAny | undefined, ZodTypeAny>): string {
  return `${def.method.toLowerCase()}${capitalize(def.id)}`;
}

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeGenerated(filePath: string, content: string): void {
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
  console.log(`  ✓ ${filePath.replace(`${ROOT}/`, '').replace(`${ROOT}\\`, '')}`);
}

// ============================================================================
// 1. OpenAPI
// ============================================================================

function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};

  for (const def of ENDPOINT_LIST) {
    const key = `/${def.path}`;
    const operation: Record<string, unknown> = {
      summary: def.summary,
      operationId: def.id,
      ...(def.requiresAuth ? { security: [{ bearerAuth: [] }] } : {}),
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: zodToJsonSchema(def.response, { target: 'openApi3' }),
              example: def.example,
            },
          },
        },
      },
    };
    paths[key] = { ...((paths[key] as object) ?? {}), [def.method.toLowerCase()]: operation };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Fumibug API',
      version: '0.1.0',
      description: 'Generado desde packages/contracts — ver docs/spec/10-api.md.',
    },
    servers: [{ url: '/v1' }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  };
}

// ============================================================================
// 2. Cliente tipado (apps/web/lib/api/client.ts)
// ============================================================================

function buildClient(): string {
  const fns: string[] = [];

  for (const def of ENDPOINT_LIST) {
    // `typeof endpoints.<id>.example` le da a cada función su tipo de retorno exacto
    // sin que el generador tenga que llevar un registro id → nombre de tipo: el campo
    // `example` de endpoints.ts ya está tipado como z.infer<Res> en su declaración.
    fns.push(
      `/** ${def.method} /v1/${def.path} — ${def.summary} */\n` +
        `export function ${functionName(def)}(): Promise<ApiResponse<typeof endpoints.${def.id}.example>> {\n` +
        `  return request('${def.method}', '${def.path}');\n` +
        `}`,
    );
  }

  return (
    GENERATED_HEADER('packages/contracts/src/endpoints.ts') +
    // Ninguno de los dos se usa como valor en runtime acá (endpoints solo entra en
    // `typeof endpoints.<id>.example`, una posición de tipo) — import type evita que
    // el bundler de Next arrastre el objeto ENDPOINTS completo al cliente.
    `import type { ApiResponse } from '@fumibug/contracts';\n` +
    `import type { ENDPOINTS as endpoints } from '@fumibug/contracts';\n\n` +
    `export interface ApiClientConfig {\n` +
    `  baseUrl: string;\n` +
    `  getAccessToken?: () => string | null | undefined;\n` +
    `}\n\n` +
    `let config: ApiClientConfig = { baseUrl: '/v1' };\n\n` +
    `/** OpenCode la llama una vez al iniciar la app con la baseUrl real y el getter del token. */\n` +
    `export function configureApiClient(next: Partial<ApiClientConfig>): void {\n` +
    `  config = { ...config, ...next };\n` +
    `}\n\n` +
    `async function request<T>(method: string, path: string): Promise<ApiResponse<T>> {\n` +
    `  const token = config.getAccessToken?.();\n` +
    `  const res = await fetch(\`\${config.baseUrl}/\${path}\`, {\n` +
    `    method,\n` +
    `    headers: {\n` +
    `      'Content-Type': 'application/json',\n` +
    `      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),\n` +
    `    },\n` +
    `  });\n` +
    `  return (await res.json()) as ApiResponse<T>;\n` +
    `}\n\n` +
    `${fns.join('\n\n')}\n`
  );
}

// ============================================================================
// 3. Mocks de MSW (apps/web/mocks/handlers.ts)
// ============================================================================

function buildMocks(): string {
  const lines = ENDPOINT_LIST.map((def) => {
    const example = JSON.stringify({ success: true, data: def.example }, null, 2)
      .split('\n')
      .join('\n  ');
    return `  http.${def.method.toLowerCase()}('/v1/${def.path}', () =>\n    HttpResponse.json(${example}),\n  ),`;
  });

  return (
    GENERATED_HEADER('packages/contracts/src/endpoints.ts') +
    `import { http, HttpResponse } from 'msw';\n\n` +
    `export const handlers = [\n${lines.join('\n')}\n];\n`
  );
}

// ============================================================================

function main(): void {
  console.log('pnpm generate — packages/contracts → apps/web/lib/api, apps/web/mocks, docs/api\n');
  writeGenerated(OPENAPI_PATH, `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
  writeGenerated(CLIENT_PATH, buildClient());
  writeGenerated(MOCKS_PATH, buildMocks());
  console.log('\nListo.');
}

main();
