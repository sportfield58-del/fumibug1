/**
 * Seed de desarrollo — PR 4 (docs/spec/08-modelo-datos.md §H, docs/spec/02-roles.md §B).
 *
 * Siembra para el tenant Fumibug:
 *   - catálogo global de permisos, tomado de @fumibug/contracts PERMISSION_KEY
 *     (fuente única de verdad: si contracts agrega un permiso, este seed lo detecta)
 *   - los 6 roles semilla de §B.3 con su matriz rol × permiso × scope
 *   - 1 owner, 1 admin, 2 operarios con perfil técnico
 *   - 1 depósito, 5 insumos con lotes y stock proyectado
 *   - tipos de servicio + 1 lista de precios con ítems
 *   - 10 clientes con contacto y ubicación georreferenciada
 *
 * Decisiones:
 *   - IDs deterministas (uuid(prefix, n)): el seed es idempotente vía upsert y se puede
 *     correr N veces sin duplicar ni romper UNIQUEs. En producción los IDs los generan
 *     Supabase Auth / la API; esto es solo dato de desarrollo. Cada familia de entidades
 *     usa un prefijo distinto dentro del último grupo del UUID.
 *   - Todo corre dentro de UNA transacción con `SET LOCAL app.tenant_id` (§K.4): las
 *     tablas tienen FORCE ROW LEVEL SECURITY, así que incluso el rol migrador necesita
 *     el GUC si no es superusuario. Mismo patrón que test/migration.integration.spec.ts.
 *   - `inventory` se siembra directo como stock inicial proyectado; los
 *     inventory_movements quedan vacíos a propósito (son append-only y representan
 *     historia operativa, no estado de carga — el primer movimiento real lo crea la API).
 *   - Fechas relativas a hoy (vencimientos de libretas y lotes): el dataset mantiene sus
 *     casos de prueba (libreta por vencer, lote próximo a vencer, stock bajo mínimo)
 *     sin importar cuándo se corra.
 */

import { PrismaClient } from '@prisma/client';
import {
  PERMISSION_KEY,
  SEED_ROLE_KEY,
  type PermissionKey,
  type PermissionScope,
  type SeedRoleKey,
} from '@fumibug/contracts';

const prisma = new PrismaClient();

/** UUID v4-formatted determinista: prefijo de familia (4 hex) + secuencia (8 hex). */
function uuid(prefix: string, sequence: number): string {
  if (!/^[0-9a-f]{4}$/.test(prefix)) {
    throw new Error(`Prefijo de UUID inválido: "${prefix}" (deben ser exactamente 4 hex)`);
  }
  return `f0000000-0000-4000-8000-${prefix}${String(sequence).padStart(8, '0')}`;
}

// Familias de UUID: tenant 0001 · usuarios 01xx · memberships 11xx · roles 12xx
// depósito 2000 · insumos 30xx · lotes 31xx · inventario 32xx · tipos 40xx
// clientes 50xx · ubicaciones 51xx · lista de precios 60xx/61xx · contactos 7xxx
const UID_FAMILY = {
  user: '0100',
  membership: '1100',
  role: '1200',
  warehouse: '2000',
  supply: '3000',
  lot: '3100',
  inventory: '3200',
  serviceType: '4000',
  customer: '5000',
  serviceLocation: '5100',
  priceList: '6000',
  priceListItem: '6100',
} as const;

const TENANT_ID = uuid('0001', 0);

const USER_IDS = {
  owner: uuid(UID_FAMILY.user, 1),
  admin: uuid(UID_FAMILY.user, 2),
  tech1: uuid(UID_FAMILY.user, 3),
  tech2: uuid(UID_FAMILY.user, 4),
} as const;

const SUPPLY_IDS = {
  cipermetrina: uuid(UID_FAMILY.supply, 1),
  bromadiolona: uuid(UID_FAMILY.supply, 2),
  deltametrina: uuid(UID_FAMILY.supply, 3),
  amonioCuaternario: uuid(UID_FAMILY.supply, 4),
  trampaLuz: uuid(UID_FAMILY.supply, 5),
} as const;

const SERVICE_TYPE_IDS = {
  desinsectacion: uuid(UID_FAMILY.serviceType, 1),
  desratizacion: uuid(UID_FAMILY.serviceType, 2),
  desinfeccion: uuid(UID_FAMILY.serviceType, 3),
  controlIntegral: uuid(UID_FAMILY.serviceType, 4),
} as const;

// ============================================================================
// Matriz rol × permiso (docs/spec/02-roles.md §B.3)
// ============================================================================

const tenantScope = (keys: PermissionKey[]) =>
  Object.fromEntries(keys.map((k) => [k, 'tenant'])) as Partial<
    Record<PermissionKey, PermissionScope>
  >;
const ownScope = (keys: PermissionKey[]) =>
  Object.fromEntries(keys.map((k) => [k, 'own'])) as Partial<
    Record<PermissionKey, PermissionScope>
  >;

const ROLE_MATRIX: Record<SeedRoleKey, Partial<Record<PermissionKey, PermissionScope>>> = {
  // Dueño: todo, incluido lo crítico (permitir negativo, anular, configuración).
  owner: tenantScope([
    'customer.read', 'customer.create', 'customer.update', 'customer.archive',
    'location.read', 'location.create', 'location.update', 'location.archive',
    'contract.read', 'contract.create', 'contract.update', 'contract.cancel',
    'service.read.tenant',
    'service.create', 'service.update', 'service.cancel', 'service.reschedule',
    'service.price.override',
    'route.read.tenant',
    'route.create', 'route.update', 'route.publish', 'route.unpublish', 'route.cancel',
    'session.reopen',
    'evidence.delete',
    'service.validate', 'service.reject',
    'certificate.read', 'certificate.issue', 'certificate.void',
    'supply.read', 'supply.create', 'supply.update',
    'inventory.read.tenant', 'inventory.transfer', 'inventory.adjust', 'inventory.allow_negative',
    'payment.read.tenant', 'payment.create', 'payment.void',
    'cash.read.tenant', 'cash.approve_closure', 'cash.adjust',
    'user.read', 'user.create', 'user.update', 'user.deactivate',
    'role.manage', 'settings.manage', 'audit.read',
    'report.operational', 'report.financial',
  ]),

  // Admin: igual al dueño excepto permitir stock negativo (§B.3).
  admin: tenantScope([
    'customer.read', 'customer.create', 'customer.update', 'customer.archive',
    'location.read', 'location.create', 'location.update', 'location.archive',
    'contract.read', 'contract.create', 'contract.update', 'contract.cancel',
    'service.read.tenant',
    'service.create', 'service.update', 'service.cancel', 'service.reschedule',
    'service.price.override',
    'route.read.tenant',
    'route.create', 'route.update', 'route.publish', 'route.unpublish', 'route.cancel',
    'session.reopen',
    'evidence.delete',
    'service.validate', 'service.reject',
    'certificate.read', 'certificate.issue', 'certificate.void',
    'supply.read', 'supply.create', 'supply.update',
    'inventory.read.tenant', 'inventory.transfer', 'inventory.adjust',
    'payment.read.tenant', 'payment.create', 'payment.void',
    'cash.read.tenant', 'cash.approve_closure', 'cash.adjust',
    'user.read', 'user.create', 'user.update', 'user.deactivate',
    'role.manage', 'settings.manage', 'audit.read',
    'report.operational', 'report.financial',
  ]),

  // Supervisor: opera el día a día pero no toca precios, usuarios ni config.
  supervisor: tenantScope([
    'customer.read', 'location.read',
    'contract.read',
    'service.read.tenant',
    'service.create', 'service.update', 'service.cancel', 'service.reschedule',
    'route.read.tenant',
    'route.create', 'route.update', 'route.publish', 'route.cancel',
    'service.validate', 'service.reject',
    'certificate.read', 'certificate.issue',
    'supply.read',
    'inventory.read.tenant', 'inventory.transfer',
    'payment.read.tenant', 'payment.create',
    'cash.read.tenant', 'cash.approve_closure', 'cash.adjust',
    'audit.read',
    'report.operational',
  ]),

  // Administrativo: carga clientes/contratos/rutas y emite certificados. Sin validar cierres.
  office: tenantScope([
    'customer.read', 'customer.create', 'customer.update', 'customer.archive',
    'location.read', 'location.create', 'location.update', 'location.archive',
    'contract.read', 'contract.create', 'contract.update',
    'service.read.tenant',
    'service.create', 'service.update', 'service.cancel', 'service.reschedule',
    'route.read.tenant',
    'route.create', 'route.update', 'route.cancel',
    'certificate.read', 'certificate.issue',
    'supply.read',
    'inventory.read.tenant',
    'payment.read.tenant', 'payment.create',
    'cash.read.tenant',
    'report.operational', 'report.financial',
  ]),

  // Operario: solo lo suyo. Nunca ve dinero ajeno ni márgenes (§B.4 regla 2).
  technician: {
    ...ownScope([
      'customer.read', 'location.read',
      'service.read.own',
      'route.read.own',
      'session.start', 'session.finish',
      'evidence.upload',
      'stop.mark_no_show', 'stop.skip',
      'service.close',
      'certificate.read',
      'inventory.read.own',
      'payment.read.own', 'payment.create',
      'cash.read.own', 'cash.close.own',
    ]),
    // El catálogo de insumos es lectura general (necesita saber qué aplica).
    'supply.read': 'tenant',
  },

  // Director Técnico: ve servicios, emite, firma y anula certificados (§B.4 regla 5).
  technical_director: tenantScope([
    'customer.read', 'location.read',
    'service.read.tenant',
    'certificate.read', 'certificate.issue', 'certificate.sign', 'certificate.void',
    'supply.read',
  ]),
};

const ROLE_META: Record<SeedRoleKey, { name: string; description: string }> = {
  owner: { name: 'Dueño', description: 'Acceso total al tenant, incluida la configuración crítica.' },
  admin: { name: 'Administrador', description: 'Administra operaciones, dinero y usuarios. No puede permitir stock negativo.' },
  supervisor: { name: 'Supervisor', description: 'Supervisa rutas, valida cierres y aprueba rendiciones hasta el límite configurado.' },
  office: { name: 'Administrativo', description: 'Carga clientes, contratos y rutas; emite certificados y registra pagos.' },
  technician: { name: 'Operario', description: 'Ejecuta servicios en campo. Solo ve sus propios servicios, stock y caja.' },
  technical_director: { name: 'Director Técnico', description: 'Único rol habilitado para firmar certificados (§B.4 regla 5).' },
};

/**
 * Autochequeo: cada permiso del catálogo debe estar asignado a al menos un rol semilla.
 * Si contracts agrega un permiso nuevo y nadie lo tiene, el seed falla ruidosamente
 * en vez de dejar un permiso huérfano imposible de descubrir después. Y al revés:
 * si la matriz referencia un permiso que ya no existe en contracts, también explota.
 */
function assertMatrixCoverage(): void {
  const granted = new Set<PermissionKey>();
  for (const perms of Object.values(ROLE_MATRIX)) {
    for (const key of Object.keys(perms)) {
      granted.add(key as PermissionKey);
    }
  }
  const missing = PERMISSION_KEY.filter((key) => !granted.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Permisos del catálogo sin rol asignado en ROLE_MATRIX: ${missing.join(', ')}`,
    );
  }
  const unknown = [...granted].filter((key) => !PERMISSION_KEY.includes(key));
  if (unknown.length > 0) {
    throw new Error(`ROLE_MATRIX referencia permisos inexistentes en contracts: ${unknown.join(', ')}`);
  }
}

// ============================================================================
// Helpers de fechas
// ============================================================================

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function timeOfDay(hours: number, minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hours, minutes));
}

/** Indexado de arrays con chequeo en runtime (strict: los índices pueden fallar). */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) {
    throw new Error(`Índice ${index} fuera de rango`);
  }
  return value;
}

// ============================================================================
// Datos
// ============================================================================

interface SeedCustomer {
  type: 'INDIVIDUAL' | 'COMPANY';
  legalName: string;
  tradeName?: string;
  taxId?: string;
  taxCondition?: 'RESPONSABLE_INSCRIPTO' | 'MONOTRIBUTO' | 'EXENTO' | 'CONSUMIDOR_FINAL' | 'NO_RESPONSABLE';
  paymentTerms?: 'CASH' | 'ACCOUNT' | 'CONTRACT';
  creditLimitCents?: bigint;
  tags: string[];
  notes?: string;
  contacts: Array<{
    name: string;
    role: 'OWNER' | 'ONSITE' | 'BILLING';
    phone?: string;
    email?: string;
    isPrimary?: boolean;
  }>;
  location: {
    label?: string;
    addressLine: string;
    city: string;
    province: string;
    postalCode: string;
    lat: number;
    lng: number;
    establishmentType: 'HOME' | 'GASTRO' | 'FOOD_INDUSTRY' | 'WAREHOUSE' | 'SCHOOL' | 'OFFICE' | 'OTHER';
    areaSqm?: number;
    accessNotes?: string;
    hazardNotes?: string;
    windowStartHour?: number;
    windowEndHour?: number;
  };
}

const CUSTOMERS: SeedCustomer[] = [
  {
    type: 'COMPANY',
    legalName: 'La Espiga Sociedad de Responsabilidad Limitada',
    tradeName: 'Panadería La Espiga',
    taxId: '30-71234561-4',
    taxCondition: 'RESPONSABLE_INSCRIPTO',
    paymentTerms: 'CONTRACT',
    tags: ['gastro', 'abono-mensual'],
    notes: 'Abono de desinsectación + desratización. Entrega de certificado firmado en mano.',
    contacts: [
      { name: 'Ana Molina', role: 'OWNER', phone: '+54 9 11 5555-0101', email: 'ana@laespiga.dev', isPrimary: true },
      { name: 'Rubén (panadero turno noche)', role: 'ONSITE', phone: '+54 9 11 5555-0102' },
    ],
    location: {
      label: 'Local y panadería',
      addressLine: 'Av. Rivadavia 8214',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1424CPT',
      lat: -34.6175,
      lng: -58.4438,
      establishmentType: 'GASTRO',
      areaSqm: 180,
      accessNotes: 'Ingresar por el local antes de las 8 h; luego portón de carga sobre la calle lateral.',
      windowStartHour: 6,
      windowEndHour: 8,
    },
  },
  {
    type: 'COMPANY',
    legalName: 'El Fogón S.A.',
    tradeName: 'Restaurante El Fogón',
    taxId: '30-71234562-3',
    taxCondition: 'RESPONSABLE_INSCRIPTO',
    paymentTerms: 'ACCOUNT',
    creditLimitCents: BigInt(50000000),
    tags: ['gastro', 'cuenta-corriente'],
    contacts: [
      { name: 'Martín Quiroga', role: 'OWNER', phone: '+54 9 11 5555-0201', email: 'martin@elfogon.dev' },
      { name: 'Sofía Cabrera', role: 'BILLING', email: 'administracion@elfogon.dev' },
      { name: 'Jefe de cocina de turno', role: 'ONSITE', isPrimary: true },
    ],
    location: {
      addressLine: 'Gorriti 5847',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1414BKD',
      lat: -34.5856,
      lng: -58.4321,
      establishmentType: 'GASTRO',
      areaSqm: 320,
      accessNotes: 'Tratamiento de cocina solo entre 15 y 17 h (pre-apertura).',
      hazardNotes: 'Llamas abiertas en cocina: coordinar apagado antes de aplicar.',
      windowStartHour: 15,
      windowEndHour: 17,
    },
  },
  {
    type: 'COMPANY',
    legalName: 'Supermercados El Progreso S.R.L.',
    tradeName: 'Supermercado El Progreso',
    taxId: '30-71234563-2',
    taxCondition: 'RESPONSABLE_INSCRIPTO',
    paymentTerms: 'CONTRACT',
    tags: ['food-industry', 'auditoria-brc', 'abono-mensual'],
    notes: 'Exige informe de tendencia de plagas por estación en cada visita (auditoría BRC).',
    contacts: [
      { name: 'Laura Ferreyra', role: 'BILLING', email: 'compras@elprogreso.dev', isPrimary: true },
      { name: 'Encargado de sala', role: 'ONSITE' },
    ],
    location: {
      label: 'Sucursal Caballito',
      addressLine: 'Av. Rivadavia 4999',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1424CJB',
      lat: -34.6201,
      lng: -58.4381,
      establishmentType: 'FOOD_INDUSTRY',
      areaSqm: 1200,
      accessNotes: 'Presentarse en recepción de proveedores con DNI y libreta sanitaria.',
      windowStartHour: 7,
      windowEndHour: 10,
    },
  },
  {
    type: 'COMPANY',
    legalName: 'Instituto Educativo San Martín',
    tradeName: 'Colegio San Martín',
    taxId: '30-71234564-1',
    taxCondition: 'EXENTO',
    paymentTerms: 'CONTRACT',
    tags: ['educacion'],
    contacts: [
      { name: 'Beatriz Núñez (vicedirectora)', role: 'OWNER', phone: '+54 9 11 5555-0401', isPrimary: true },
    ],
    location: {
      addressLine: 'Av. Avellaneda 3184',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1406FSE',
      lat: -34.6339,
      lng: -58.4805,
      establishmentType: 'SCHOOL',
      areaSqm: 2400,
      accessNotes: 'Solo sábados o feriados. Aplicar con aulas desocupadas y ventear 4 h.',
      windowStartHour: 8,
      windowEndHour: 13,
    },
  },
  {
    type: 'COMPANY',
    legalName: 'Hotelera Costa Azul S.A.',
    tradeName: 'Hotel Costa Azul',
    taxId: '30-71234565-9',
    taxCondition: 'RESPONSABLE_INSCRIPTO',
    paymentTerms: 'ACCOUNT',
    creditLimitCents: BigInt(120000000),
    tags: ['hospitality', 'prioridad-alta'],
    notes: 'Sensible a chinches. Toda revisita por chinche es garantía, no genera ingreso.',
    contacts: [
      { name: 'Gabriel Rossi (housekeeping)', role: 'ONSITE', phone: '+54 9 11 5555-0501', isPrimary: true },
      { name: 'Valeria Ponce', role: 'BILLING', email: 'pagos@costaazul.dev' },
    ],
    location: {
      addressLine: 'Av. Callao 123',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1022AAA',
      lat: -34.5976,
      lng: -58.3872,
      establishmentType: 'OTHER',
      areaSqm: 5200,
      accessNotes: 'Estacionamiento propio sobre Paraguay. Pedir tarjeta de acceso en recepción.',
    },
  },
  {
    type: 'COMPANY',
    legalName: 'Pastas Dora S.H.',
    tradeName: 'Fábrica de Pastas Dora',
    taxId: '30-71234566-8',
    taxCondition: 'MONOTRIBUTO',
    paymentTerms: 'CONTRACT',
    tags: ['food-industry'],
    contacts: [
      { name: 'Dora Sánchez', role: 'OWNER', phone: '+54 9 11 5555-0601', isPrimary: true },
    ],
    location: {
      addressLine: 'Zelaya 3150',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1193ABF',
      lat: -34.6032,
      lng: -58.4189,
      establishmentType: 'FOOD_INDUSTRY',
      areaSqm: 240,
      accessNotes: 'Tocar timbre dos veces; con la moledora encendida no escuchan.',
      hazardNotes: 'Harina en ambiente: riesgo de inflamabilidad, no nebulizar.',
    },
  },
  {
    type: 'COMPANY',
    legalName: 'Logística Sur Depósitos S.R.L.',
    tradeName: 'Depósito Logística Sur',
    taxId: '30-71234567-7',
    taxCondition: 'RESPONSABLE_INSCRIPTO',
    paymentTerms: 'ACCOUNT',
    creditLimitCents: BigInt(80000000),
    tags: ['logistica', 'zona-sur'],
    contacts: [
      { name: 'Hugo Báez (jefe de depósito)', role: 'ONSITE', phone: '+54 9 11 5555-0701', isPrimary: true },
      { name: 'Administración Logística Sur', role: 'BILLING', email: 'admin@logisticasur.dev' },
    ],
    location: {
      addressLine: 'Hipólito Yrigoyen 14202',
      city: 'Lomas de Zamora',
      province: 'Buenos Aires',
      postalCode: 'B1832ABC',
      lat: -34.7627,
      lng: -58.4025,
      establishmentType: 'WAREHOUSE',
      areaSqm: 8600,
      accessNotes: 'Portón 3 (fondo). Anunciar llegada 15 min antes al jefe de depósito.',
      windowStartHour: 9,
      windowEndHour: 16,
    },
  },
  {
    type: 'COMPANY',
    legalName: 'Marino & Asociados Estudio Contable',
    tradeName: 'Estudio Contable Marino',
    taxId: '30-71234568-6',
    taxCondition: 'RESPONSABLE_INSCRIPTO',
    paymentTerms: 'CASH',
    tags: ['oficinas'],
    contacts: [
      { name: 'Claudia Marino', role: 'OWNER', phone: '+54 9 11 5555-0801', email: 'claudia@marinocontadores.dev', isPrimary: true },
    ],
    location: {
      addressLine: 'Av. Córdoba 1423, piso 4°',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1055AAV',
      lat: -34.5966,
      lng: -58.3806,
      establishmentType: 'OFFICE',
      areaSqm: 140,
      accessNotes: 'Edificio con acceso credencial: avisar a administración con 24 h.',
    },
  },
  {
    type: 'INDIVIDUAL',
    legalName: 'Juana Pérez',
    taxId: '27-28123456-4',
    taxCondition: 'CONSUMIDOR_FINAL',
    paymentTerms: 'CASH',
    tags: ['particular'],
    notes: 'Caso de cucarachas en cocina. Revisita a los 15 días incluida en el precio.',
    contacts: [
      { name: 'Juana Pérez', role: 'OWNER', phone: '+54 9 11 5555-0901', isPrimary: true },
    ],
    location: {
      addressLine: 'Lacarra 842, depto 3°B',
      city: 'Buenos Aires',
      province: 'Ciudad Autónoma de Buenos Aires',
      postalCode: 'C1447AAD',
      lat: -34.6392,
      lng: -58.4938,
      establishmentType: 'HOME',
      areaSqm: 65,
      accessNotes: 'Departamento. Coordinar con el encargado si no responde el timbre.',
    },
  },
  {
    type: 'INDIVIDUAL',
    legalName: 'Roberto Álvarez',
    taxId: '20-29123456-1',
    taxCondition: 'MONOTRIBUTO',
    paymentTerms: 'CASH',
    tags: ['particular', 'zona-oeste'],
    contacts: [
      { name: 'Roberto Álvarez', role: 'OWNER', phone: '+54 9 11 5555-1001', isPrimary: true },
    ],
    location: {
      addressLine: 'República Oriental del Uruguay 1256',
      city: 'Morón',
      province: 'Buenos Aires',
      postalCode: 'B1748ABC',
      lat: -34.6531,
      lng: -58.6233,
      establishmentType: 'HOME',
      areaSqm: 110,
      accessNotes: 'Casa con fondo: perro suelto, pedir que lo sujeten antes de entrar.',
      hazardNotes: 'Pozo ciego en el fondo, tapado con tablón suelto.',
    },
  },
];

// ============================================================================
// Seed
// ============================================================================

async function seed(): Promise<void> {
  assertMatrixCoverage();

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${TENANT_ID}'`);

      // ---------------------------------------------------------------- tenant
      const tenant = await tx.tenant.upsert({
        where: { id: TENANT_ID },
        update: {},
        create: {
          id: TENANT_ID,
          name: 'Fumibug',
          slug: 'fumibug',
          legalName: 'Fumibug S.R.L.',
          taxId: '30-71548721-5',
          healthAuthorizationNumber: 'HAB-CABA-2026-0891',
          address: 'Av. Rivadavia 5217',
          phone: '+54 11 4444-2026',
          email: 'hola@fumibug.dev',
          plan: 'CORE',
          status: 'ACTIVE',
        },
      });

      // ----------------------------------------------------------- permisos
      for (const key of PERMISSION_KEY) {
        const [resource = '', ...actionParts] = key.split('.');
        await tx.permission.upsert({
          where: { key },
          update: {},
          create: { key, resource, action: actionParts.join('.') },
        });
      }

      // -------------------------------------------------------------- roles
      const roleKeys = SEED_ROLE_KEY as unknown as SeedRoleKey[];
      const roleIds = {} as Record<SeedRoleKey, string>;
      for (const [index, key] of roleKeys.entries()) {
        const meta = ROLE_META[key];
        const role = await tx.role.upsert({
          where: { tenantId_key: { tenantId: TENANT_ID, key } },
          update: {},
          create: {
            id: uuid(UID_FAMILY.role, index + 1),
            tenantId: TENANT_ID,
            key,
            name: meta.name,
            description: meta.description,
            isSystem: true,
          },
        });
        roleIds[key] = role.id;
      }

      // Tabla puente sin surrogate id: delete+create dentro de la misma transacción
      // es idempotente y refleja exactamente la matriz (un upsert dejaría vieja una
      // fila cuyo scope cambió, porque la PK es roleId+permissionKey).
      const rolePermissionRows = Object.entries(ROLE_MATRIX).flatMap(([roleKey, perms]) =>
        Object.entries(perms).map(([permissionKey, scope]) => ({
          tenantId: TENANT_ID,
          roleId: roleIds[roleKey as SeedRoleKey],
          permissionKey,
          scope: scope ?? 'tenant',
        })),
      );
      await tx.rolePermission.deleteMany({ where: { tenantId: TENANT_ID } });
      await tx.rolePermission.createMany({ data: rolePermissionRows });

      // ------------------------------------------------------------- usuarios
      const users = [
        {
          id: USER_IDS.owner,
          email: 'carlos@fumibug.dev',
          username: 'carlos.gimenez',
          fullName: 'Carlos Giménez',
          phone: '+54 9 11 4444-0001',
          color: '#DC2626',
        },
        {
          id: USER_IDS.admin,
          email: 'lucia@fumibug.dev',
          username: 'lucia.herrera',
          fullName: 'Lucía Herrera',
          phone: '+54 9 11 4444-0002',
          color: '#2563EB',
        },
        {
          id: USER_IDS.tech1,
          email: 'diego@fumibug.dev',
          username: 'diego.sosa',
          fullName: 'Diego Sosa',
          phone: '+54 9 11 4444-0003',
          color: '#059669',
        },
        {
          id: USER_IDS.tech2,
          email: 'marina@fumibug.dev',
          username: 'marina.lopez',
          fullName: 'Marina López',
          phone: '+54 9 11 4444-0004',
          color: '#EA580C',
        },
      ];
      for (const user of users) {
        await tx.user.upsert({
          where: { id: user.id },
          update: {},
          create: user,
        });
      }

      const memberships = [
        { userId: USER_IDS.owner, roleId: roleIds.owner },
        { userId: USER_IDS.admin, roleId: roleIds.admin },
        { userId: USER_IDS.tech1, roleId: roleIds.technician },
        { userId: USER_IDS.tech2, roleId: roleIds.technician },
      ];
      for (const [index, membership] of memberships.entries()) {
        await tx.membership.upsert({
          where: { id: uuid(UID_FAMILY.membership, index + 1) },
          update: {},
          create: {
            id: uuid(UID_FAMILY.membership, index + 1),
            tenantId: TENANT_ID,
            userId: membership.userId,
            roleId: membership.roleId,
          },
        });
      }

      // Perfiles técnicos. La libreta de Marina vence en ~25 días a propósito:
      // deja vivo el caso "alerta a 30 días / bloqueo R15" para probar UI y backend.
      const technicians = [
        { userId: USER_IDS.tech1, licenseNumber: 'LS-48213', expiresInDays: 420 },
        { userId: USER_IDS.tech2, licenseNumber: 'LS-51902', expiresInDays: 25 },
      ];
      for (const tech of technicians) {
        await tx.technicianProfile.upsert({
          where: { userId: tech.userId },
          update: {},
          create: {
            userId: tech.userId,
            tenantId: TENANT_ID,
            licenseNumber: tech.licenseNumber,
            licenseType: 'SANITARY_BOOK',
            licenseExpiresAt: dateOnly(daysFromNow(tech.expiresInDays)),
          },
        });
      }

      // ------------------------------------------------------------ depósito
      const warehouse = await tx.stockLocation.upsert({
        where: { id: uuid(UID_FAMILY.warehouse, 1) },
        update: {},
        create: {
          id: uuid(UID_FAMILY.warehouse, 1),
          tenantId: TENANT_ID,
          type: 'WAREHOUSE',
          name: 'Depósito Central',
          createdBy: USER_IDS.admin,
          updatedBy: USER_IDS.admin,
        },
      });

      // ------------------------------------------------------------ insumos
      const supplies = [
        {
          id: SUPPLY_IDS.cipermetrina,
          sku: 'INS-CIP-001',
          name: 'Cipermetrina 25% EC',
          category: 'INSECTICIDE',
          activeIngredient: 'Cipermetrina',
          concentration: '25% EC',
          registryAuthority: 'SENASA',
          registryNumber: '6390-15-V',
          purchaseUnit: 'L',
          applicationUnit: 'ML',
          dilutionRateMlPerL: 20,
          dosePerSqm: 50,
          reentryHours: 4,
          unitCostCents: BigInt(1850000),
          requiresLotTracking: true,
          minStock: 2,
        },
        {
          id: SUPPLY_IDS.bromadiolona,
          sku: 'INS-BRO-001',
          name: 'Bromadiolona 0.005% cebo pellets',
          category: 'RODENTICIDE',
          activeIngredient: 'Bromadiolona',
          concentration: '0.005%',
          registryAuthority: 'SENASA',
          registryNumber: '3245-11-R',
          purchaseUnit: 'KG',
          applicationUnit: 'G',
          dilutionRateMlPerL: null,
          dosePerSqm: null,
          reentryHours: null,
          unitCostCents: BigInt(4200000),
          requiresLotTracking: true,
          minStock: 1,
        },
        {
          id: SUPPLY_IDS.deltametrina,
          sku: 'INS-DEL-001',
          name: 'Deltametrina 2.5% SC',
          category: 'INSECTICIDE',
          activeIngredient: 'Deltametrina',
          concentration: '2.5% SC',
          registryAuthority: 'SENASA',
          registryNumber: '5821-13-V',
          purchaseUnit: 'L',
          applicationUnit: 'ML',
          dilutionRateMlPerL: 10,
          dosePerSqm: 40,
          reentryHours: 6,
          unitCostCents: BigInt(2100000),
          requiresLotTracking: true,
          minStock: 1,
        },
        {
          id: SUPPLY_IDS.amonioCuaternario,
          sku: 'INS-AMQ-001',
          name: 'Amonio Cuaternario 10%',
          category: 'DISINFECTANT',
          activeIngredient: 'Cloruro de alquil dimetil bencil amonio',
          concentration: '10%',
          registryAuthority: 'ANMAT',
          registryNumber: 'P-44718-2',
          purchaseUnit: 'L',
          applicationUnit: 'ML',
          dilutionRateMlPerL: 25,
          dosePerSqm: 80,
          reentryHours: 2,
          unitCostCents: BigInt(980000),
          requiresLotTracking: true,
          minStock: 3,
        },
        {
          id: SUPPLY_IDS.trampaLuz,
          sku: 'INS-TLP-002',
          name: 'Trampa de luz para insectos 30W',
          category: 'TRAP',
          activeIngredient: null,
          concentration: null,
          registryAuthority: 'OTHER',
          registryNumber: 'EXENTO',
          purchaseUnit: 'UNIT',
          applicationUnit: 'UNIT',
          dilutionRateMlPerL: null,
          dosePerSqm: null,
          reentryHours: null,
          unitCostCents: BigInt(5500000),
          requiresLotTracking: false,
          minStock: 2,
        },
      ] as const;
      for (const supply of supplies) {
        await tx.supply.upsert({
          where: { tenantId_sku: { tenantId: TENANT_ID, sku: supply.sku } },
          update: {},
          create: { ...supply, tenantId: TENANT_ID, createdBy: USER_IDS.admin, updatedBy: USER_IDS.admin },
        });
      }

      // Lotes + stock inicial proyectado. El lote de Deltametrina vence pronto
      // (alerta de producto por vencer) y la Bromadiolona queda bajo mínimo
      // (alerta de reposición): tres alertas del dashboard con datos reales.
      const lotRows = [
        { supplyIndex: 0, lotCode: 'C-2409-A', expiresInDays: 300, quantity: 4.5 },
        { supplyIndex: 1, lotCode: 'B-2502-B', expiresInDays: 150, quantity: 0.8 },
        { supplyIndex: 2, lotCode: 'D-2501-A', expiresInDays: 45, quantity: 2 },
        { supplyIndex: 3, lotCode: 'A-2503-C', expiresInDays: 200, quantity: 6 },
      ];
      let lotCount = 0;
      for (const [index, row] of lotRows.entries()) {
        const supply = at(supplies, row.supplyIndex);
        const lot = await tx.supplyLot.upsert({
          where: {
            tenantId_supplyId_lotCode: {
              tenantId: TENANT_ID,
              supplyId: supply.id,
              lotCode: row.lotCode,
            },
          },
          update: {},
          create: {
            id: uuid(UID_FAMILY.lot, index + 1),
            tenantId: TENANT_ID,
            supplyId: supply.id,
            lotCode: row.lotCode,
            expiresOn: dateOnly(daysFromNow(row.expiresInDays)),
            receivedAt: daysFromNow(-60),
            unitCostCents: supply.unitCostCents,
          },
        });
        await tx.inventory.upsert({
          where: { id: uuid(UID_FAMILY.inventory, index + 1) },
          update: {},
          create: {
            id: uuid(UID_FAMILY.inventory, index + 1),
            tenantId: TENANT_ID,
            stockLocationId: warehouse.id,
            supplyId: supply.id,
            lotId: lot.id,
            quantity: row.quantity,
          },
        });
        lotCount += 1;
      }
      // Trampas de luz sin trazabilidad de lote: fila de inventario con lot_id NULL.
      await tx.inventory.upsert({
        where: { id: uuid(UID_FAMILY.inventory, 5) },
        update: {},
        create: {
          id: uuid(UID_FAMILY.inventory, 5),
          tenantId: TENANT_ID,
          stockLocationId: warehouse.id,
          supplyId: SUPPLY_IDS.trampaLuz,
          lotId: null,
          quantity: 4,
        },
      });

      // --------------------------------------------- tipos de servicio y precios
      const serviceTypes = [
        {
          id: SERVICE_TYPE_IDS.desinsectacion,
          key: 'desinsectacion',
          name: 'Desinsectación',
          defaultDurationMinutes: 60,
          checklist: ['Inspección inicial', 'Aplicación residual', 'Gel en puntos críticos'],
          requiredSupplyIds: [SUPPLY_IDS.cipermetrina],
          certificateTemplateKey: 'cert-standard-v1',
        },
        {
          id: SERVICE_TYPE_IDS.desratizacion,
          key: 'desratizacion',
          name: 'Desratización',
          defaultDurationMinutes: 45,
          checklist: ['Mapeo de roderas', 'Colocación de ceberos', 'Sellado de ingresos'],
          requiredSupplyIds: [SUPPLY_IDS.bromadiolona],
          certificateTemplateKey: 'cert-standard-v1',
        },
        {
          id: SERVICE_TYPE_IDS.desinfeccion,
          key: 'desinfeccion',
          name: 'Desinfección',
          defaultDurationMinutes: 60,
          checklist: ['Limpieza previa', 'Nebulización', 'Tiempo de contacto'],
          requiredSupplyIds: [SUPPLY_IDS.amonioCuaternario],
          certificateTemplateKey: 'cert-standard-v1',
        },
        {
          id: SERVICE_TYPE_IDS.controlIntegral,
          key: 'control-integral',
          name: 'Control Integral de Plagas',
          defaultDurationMinutes: 90,
          checklist: ['Inspección integral', 'Desinsectación', 'Desratización', 'Informe de tendencia'],
          requiredSupplyIds: [SUPPLY_IDS.cipermetrina, SUPPLY_IDS.bromadiolona],
          certificateTemplateKey: 'cert-gastro-v1',
        },
      ];
      for (const serviceType of serviceTypes) {
        await tx.serviceType.upsert({
          where: { tenantId_key: { tenantId: TENANT_ID, key: serviceType.key } },
          update: {},
          create: { ...serviceType, tenantId: TENANT_ID },
        });
      }

      const priceList = await tx.priceList.upsert({
        where: { id: uuid(UID_FAMILY.priceList, 1) },
        update: {},
        create: {
          id: uuid(UID_FAMILY.priceList, 1),
          tenantId: TENANT_ID,
          name: 'Lista General 2026',
          validFrom: new Date(Date.UTC(2026, 0, 1)),
          validTo: null,
          isDefault: true,
          createdBy: USER_IDS.admin,
          updatedBy: USER_IDS.admin,
        },
      });

      const priceItems = [
        {
          serviceTypeIndex: 0,
          establishmentType: 'HOME' as const,
          priceCents: BigInt(9800000),
          pricePerSqmCents: null,
        },
        {
          serviceTypeIndex: 0,
          establishmentType: 'GASTRO' as const,
          priceCents: BigInt(14500000),
          pricePerSqmCents: null,
        },
        {
          serviceTypeIndex: 1,
          establishmentType: null,
          priceCents: BigInt(7500000),
          pricePerSqmCents: null,
        },
        {
          serviceTypeIndex: 2,
          establishmentType: null,
          priceCents: BigInt(8200000),
          pricePerSqmCents: null,
        },
        {
          serviceTypeIndex: 3,
          establishmentType: 'FOOD_INDUSTRY' as const,
          priceCents: BigInt(26000000),
          pricePerSqmCents: BigInt(95000),
        },
      ];
      for (const [index, item] of priceItems.entries()) {
        await tx.priceListItem.upsert({
          where: { id: uuid(UID_FAMILY.priceListItem, index + 1) },
          update: {},
          create: {
            id: uuid(UID_FAMILY.priceListItem, index + 1),
            tenantId: TENANT_ID,
            priceListId: priceList.id,
            serviceTypeId: at(serviceTypes, item.serviceTypeIndex).id,
            establishmentType: item.establishmentType,
            priceCents: item.priceCents,
            pricePerSqmCents: item.pricePerSqmCents,
          },
        });
      }

      // ---------------------------------------------------------- clientes
      for (const [index, customer] of CUSTOMERS.entries()) {
        const customerId = uuid(UID_FAMILY.customer, index + 1);
        await tx.customer.upsert({
          where: { id: customerId },
          update: {},
          create: {
            id: customerId,
            tenantId: TENANT_ID,
            type: customer.type,
            legalName: customer.legalName,
            tradeName: customer.tradeName ?? null,
            taxId: customer.taxId ?? null,
            taxCondition: customer.taxCondition ?? null,
            paymentTerms: customer.paymentTerms ?? 'CASH',
            creditLimitCents: customer.creditLimitCents ?? null,
            notes: customer.notes ?? null,
            tags: customer.tags,
            createdBy: USER_IDS.admin,
            updatedBy: USER_IDS.admin,
          },
        });

        for (const [contactIndex, contact] of customer.contacts.entries()) {
          await tx.customerContact.upsert({
            where: {
              // 7000-7099: cliente 1-9 · 7100-7199: cliente 10+ (dos dígitos de contacto)
              id: uuid(
                index < 9 ? `70${index + 1}0` : `71${index - 9}0`,
                contactIndex + 1,
              ),
            },
            update: {},
            create: {
              id: uuid(
                index < 9 ? `70${index + 1}0` : `71${index - 9}0`,
                contactIndex + 1,
              ),
              tenantId: TENANT_ID,
              customerId,
              name: contact.name,
              role: contact.role,
              phone: contact.phone ?? null,
              email: contact.email ?? null,
              isPrimary: contact.isPrimary ?? false,
            },
          });
        }

        await tx.serviceLocation.upsert({
          where: { id: uuid(UID_FAMILY.serviceLocation, index + 1) },
          update: {},
          create: {
            id: uuid(UID_FAMILY.serviceLocation, index + 1),
            tenantId: TENANT_ID,
            customerId,
            label: customer.location.label ?? null,
            addressLine: customer.location.addressLine,
            city: customer.location.city,
            province: customer.location.province,
            postalCode: customer.location.postalCode,
            lat: customer.location.lat,
            lng: customer.location.lng,
            geocodeStatus: 'OK',
            accessNotes: customer.location.accessNotes ?? null,
            hazardNotes: customer.location.hazardNotes ?? null,
            establishmentType: customer.location.establishmentType,
            areaSqm: customer.location.areaSqm ?? null,
            serviceWindowStart:
              customer.location.windowStartHour !== undefined
                ? timeOfDay(customer.location.windowStartHour, 0)
                : null,
            serviceWindowEnd:
              customer.location.windowEndHour !== undefined
                ? timeOfDay(customer.location.windowEndHour, 0)
                : null,
          },
        });
      }

      // --------------------------------------------------------- verificación
      const [permCount, roleCount, rpCount, userCount, membershipCount, customerCount, locationCount, supplyCount, lotRowsCount, invCount, priceItemCount] =
        await Promise.all([
          tx.permission.count(),
          tx.role.count({ where: { tenantId: TENANT_ID } }),
          tx.rolePermission.count({ where: { tenantId: TENANT_ID } }),
          tx.user.count({ where: { id: { in: Object.values(USER_IDS) } } }),
          tx.membership.count({ where: { tenantId: TENANT_ID } }),
          tx.customer.count({ where: { tenantId: TENANT_ID } }),
          tx.serviceLocation.count({ where: { tenantId: TENANT_ID } }),
          tx.supply.count({ where: { tenantId: TENANT_ID } }),
          tx.supplyLot.count({ where: { tenantId: TENANT_ID } }),
          tx.inventory.count({ where: { tenantId: TENANT_ID } }),
          tx.priceListItem.count({ where: { tenantId: TENANT_ID } }),
        ]);

      console.log(
        [
          '',
          'Seed completada ✔',
          `  tenant             ${tenant.slug} (${tenant.id})`,
          `  permisos           ${permCount} (catálogo completo desde contracts)`,
          `  roles              ${roleCount} · role_permissions ${rpCount}`,
          `  usuarios           ${userCount} (${membershipCount} memberships: owner, admin, 2 operarios)`,
          `  clientes           ${customerCount} · ubicaciones ${locationCount}`,
          `  insumos            ${supplyCount} · lotes ${lotRowsCount} · filas de stock ${invCount} · ítems de lista ${priceItemCount}`,
          '',
          'Casos de prueba vivos:',
          '  · libreta de Marina López vence en ~25 días (alerta 30 días / R15)',
          '  · lote D-2501-A de Deltametrina vence en ~45 días (producto por vencer)',
          '  · Bromadiolona B-2502-B bajo stock mínimo (alerta de reposición)',
          '',
          'Usuarios de desarrollo: carlos@fumibug.dev · lucia@fumibug.dev · diego@fumibug.dev · marina@fumibug.dev',
          '(IDs deterministas; cuando exista Supabase Auth, crear ahí los mismos UUID)',
        ].join('\n'),
      );
    },
    { timeout: 60000, maxWait: 10000 },
  );
}

seed()
  .then(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error('Seed falló:', error);
    void prisma.$disconnect().finally(() => {
      process.exitCode = 1;
    });
  });
