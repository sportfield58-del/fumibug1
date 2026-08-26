import type {
  CashClosureStatus,
  CertificateStatus,
  RouteStatus,
  RouteStopStatus,
  ServiceSessionStatus,
  ServiceStatus,
} from '@fumibug/contracts';

/**
 * Tablas de transición — docs/spec/04-estados.md. Ninguna todavía tiene un módulo que
 * las use (Fase 0 es plataforma sin negocio), pero construirlas ahora, contra el texto
 * exacto del spec, es más barato que reinventarlas mal apurado en cada módulo de Fase 1.
 *
 * `table` es SIEMPRE un literal fijo acá — nunca un valor que llegue de una request.
 * Es lo que hace seguro usar Prisma.raw() para interpolar el nombre de tabla en
 * StateMachineService (§K.5: Prisma.sql no permite parametrizar identificadores).
 */

export interface EntityStateMachineConfig<S extends string> {
  table: string;
  /** Tipo ENUM de Postgres de la columna status, para el cast explícito en el UPDATE. */
  statusEnumType: string;
  hasVersion: boolean;
  transitions: Record<S, readonly S[]>;
}

/** §D.3 — incluye el árbol completo de la tabla de transiciones, no solo el diagrama. */
const SERVICE_TRANSITIONS: Record<ServiceStatus, readonly ServiceStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['SCHEDULED', 'DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['ASSIGNED', 'IN_EXECUTION', 'CANCELLED'],
  IN_EXECUTION: ['PENDING_VALIDATION', 'CANCELLED'],
  PENDING_VALIDATION: ['COMPLETED', 'PARTIALLY_COMPLETED', 'IN_EXECUTION', 'CANCELLED'],
  COMPLETED: ['IN_EXECUTION'], // reopen — session.reopen, Admin/Owner, ventana 7 días (R5)
  PARTIALLY_COMPLETED: [],
  RESCHEDULED: ['SCHEDULED'],
  CANCELLED: [],
};

/** §D.4 */
const ROUTE_TRANSITIONS: Record<RouteStatus, readonly RouteStatus[]> = {
  DRAFT: ['READY', 'CANCELLED'],
  READY: ['DRAFT', 'PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['IN_PROGRESS', 'DRAFT', 'CANCELLED'], // DRAFT = unpublish, solo si ningún stop arrancó (R14)
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** §D.5 — EN_ROUTE es opcional (PENDING puede ir directo a ARRIVED). */
const ROUTE_STOP_TRANSITIONS: Record<RouteStopStatus, readonly RouteStopStatus[]> = {
  PENDING: ['EN_ROUTE', 'ARRIVED', 'SKIPPED', 'CANCELLED'],
  EN_ROUTE: ['ARRIVED', 'SKIPPED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'NO_SHOW', 'INACCESSIBLE'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
  NO_SHOW: [],
  INACCESSIBLE: [],
  SKIPPED: [],
  CANCELLED: [],
};

/** §D.6 — REOPENED no es un valor de enum acá: se modela con service_sessions.reopened_count. */
const SERVICE_SESSION_TRANSITIONS: Record<ServiceSessionStatus, readonly ServiceSessionStatus[]> = {
  OPEN: ['CLOSED'],
  CLOSED: ['OPEN'],
};

/** §D.7 */
const CASH_CLOSURE_TRANSITIONS: Record<CashClosureStatus, readonly CashClosureStatus[]> = {
  OPEN: ['DECLARED'],
  DECLARED: ['RECONCILED', 'DISPUTED'],
  RECONCILED: [],
  DISPUTED: ['RECONCILED'],
};

/** §D.7 */
const CERTIFICATE_TRANSITIONS: Record<CertificateStatus, readonly CertificateStatus[]> = {
  DRAFT: ['ISSUED'],
  ISSUED: ['SIGNED', 'VOIDED'],
  SIGNED: ['VOIDED'],
  VOIDED: [],
};

export const STATE_MACHINES = {
  service: {
    table: 'services',
    statusEnumType: 'ServiceStatus',
    hasVersion: true,
    transitions: SERVICE_TRANSITIONS,
  },
  route: {
    table: 'routes',
    statusEnumType: 'RouteStatus',
    hasVersion: true,
    transitions: ROUTE_TRANSITIONS,
  },
  route_stop: {
    table: 'route_stops',
    statusEnumType: 'RouteStopStatus',
    hasVersion: true,
    transitions: ROUTE_STOP_TRANSITIONS,
  },
  service_session: {
    table: 'service_sessions',
    statusEnumType: 'ServiceSessionStatus',
    hasVersion: false,
    transitions: SERVICE_SESSION_TRANSITIONS,
  },
  cash_closure: {
    table: 'cash_closures',
    statusEnumType: 'CashClosureStatus',
    hasVersion: false,
    transitions: CASH_CLOSURE_TRANSITIONS,
  },
  certificate: {
    table: 'certificates',
    statusEnumType: 'CertificateStatus',
    hasVersion: false,
    transitions: CERTIFICATE_TRANSITIONS,
  },
} as const satisfies Record<string, EntityStateMachineConfig<string>>;

export type StateMachineEntity = keyof typeof STATE_MACHINES;
export type EntityStatus<E extends StateMachineEntity> = (typeof STATE_MACHINES)[E] extends EntityStateMachineConfig<
  infer S
>
  ? S
  : never;
