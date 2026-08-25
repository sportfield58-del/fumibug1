import type { Prisma, PrismaClient } from '@fumibug/db';
import { requestAls } from './request-context';

/**
 * Capa 1 del aislamiento multi-tenant — docs/spec/11-seguridad.md §K.4.
 *
 * La extensión inyecta `tenantId` en TODA operación sobre modelos tenant-scoped,
 * tomándolo del RequestContext (AsyncLocalStorage). Olvidarse el filtro deja de ser
 * posible: la query sin contexto directamente lanza excepción (criterio §18: "un
 * findMany sin contexto de tenant lanza excepción").
 *
 * Defensa en profundidad: esta capa es la principal, pero NO la única. Los modelos
 * globales (Tenant/User/Permission, ver schema.prisma) quedan fuera a propósito.
 */

/**
 * Modelos que tienen columna tenant_id. Derivado de packages/db/schema.prisma
 * (36 modelos). Al agregar una tabla nueva con tenant_id hay que sumarla acá;
 * el test de arquitectura de PR9 (§K.4 Capa 3) valida contra el esquema real.
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  'Membership',
  'Role',
  'RolePermission',
  'TechnicianProfile',
  'Customer',
  'CustomerContact',
  'ServiceLocation',
  'ServiceType',
  'ServiceContract',
  'ContractLocation',
  'Service',
  'Route',
  'RouteStop',
  'ServiceSession',
  'ServiceEvidence',
  'Supply',
  'StockLocation',
  'SupplyLot',
  'Inventory',
  'InventoryMovement',
  'ServiceSupplyUsage',
  'Payment',
  'CashAccount',
  'CashMovement',
  'CashClosure',
  'Certificate',
  'PriceList',
  'PriceListItem',
  'Notification',
  'PushSubscription',
  'AuditLog',
  'SyncEvent',
  'Zone',
  'Vehicle',
  'MonitoringStation',
  'StationReading',
]);

/** Operaciones cuyo `where` admite filtros adicionales (no-unique). */
const FILTER_OPERATIONS: ReadonlySet<string> = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operaciones que crean filas: el tenant va en `data`. */
const CREATE_OPERATIONS: ReadonlySet<string> = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
]);

/**
 * Operaciones dirigidas por clave única (findUnique/update/delete/upsert).
 *
 * El `where` de estas operaciones solo admite campos únicos, así que NO se le puede
 * inyectar tenantId sin romper la validación de Prisma. Para estas, la protección la
 * da la Capa 2 (RLS con SET LOCAL app.tenant_id): un id de otro tenant simplemente
 * no existe dentro de la transacción y la respuesta es 404 (R40). Lo que sí exigimos
 * acá es que exista contexto de tenant, para que un llamado mal cableado explote en
 * desarrollo en lugar de colarse.
 */
const UNIQUE_OPERATIONS: ReadonlySet<string> = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
]);

/**
 * Función pura (testeable sin Prisma) que aplica el scoping sobre los args de una
 * operación. Muta `args` y lo devuelve. Lanza si el modelo es tenant-scoped y no
 * hay tenantId en el contexto — ese es el contrato de §K.4 Capa 1.
 */
export function applyTenantScope(
  model: string,
  operation: string,
  args: Record<string, unknown>,
  tenantId: string | undefined,
): Record<string, unknown> {
  if (!TENANT_SCOPED_MODELS.has(model)) return args;

  if (!tenantId) {
    throw new Error(
      `Query a ${model}.${operation} sin tenant en contexto. ` +
        'Toda operación sobre modelos tenant-scoped debe correr dentro del request ' +
        '(docs/spec/11-seguridad.md §K.4 Capa 1).',
    );
  }

  if (FILTER_OPERATIONS.has(operation)) {
    mergeTenantIntoWhere(args, tenantId);
  } else if (CREATE_OPERATIONS.has(operation)) {
    injectTenantIntoData(args, tenantId);
  } else if (UNIQUE_OPERATIONS.has(operation)) {
    // El `where` único no admite filtros extra: la protección es Capa 2 (RLS).
    // Solo upsert genera filas nuevas, así que ahí sí va el tenant.
    if (operation === 'upsert') {
      args['create'] = { ...(args['create'] as object), tenantId };
    }
  }
  // Operaciones desconocidas (Prisma nuevo): quedan sin tocar y las cubre RLS.

  return args;
}

/** Envuelve el `where` existente en un AND con el filtro de tenant. */
function mergeTenantIntoWhere(args: Record<string, unknown>, tenantId: string): void {
  const current = args['where'];
  args['where'] = { AND: [current ?? {}, { tenantId }] };
}

/** Inyecta tenantId en `data`, soportando el formato lista de createMany. */
function injectTenantIntoData(args: Record<string, unknown>, tenantId: string): void {
  const data = args['data'];
  if (Array.isArray(data)) {
    args['data'] = data.map((row) => ({ ...(row as object), tenantId }));
  } else if (data !== null && typeof data === 'object') {
    args['data'] = { ...(data), tenantId };
  }
}

/**
 * Cliente extendido. El tipo se deriva de la función para que los servicios tengan
 * autocompletado completo sin declarar tipos a mano (regla: no inventar tipos).
 */
export function withTenantScope(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const tenantId = requestAls.getStore()?.tenantId;
          const scoped =
            model !== undefined
              ? applyTenantScope(model, operation, args, tenantId)
              : args;
          return query(scoped);
        },
      },
    },
  });
}

export type TenantDbClient = ReturnType<typeof withTenantScope>;

/** Tipo del cliente transaccional que reciben los servicios (forma estándar Prisma). */
export type RequestTx = Prisma.TransactionClient;
