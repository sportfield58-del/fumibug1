import { z } from 'zod';
import {
  ApplicationMethodSchema,
  GpsStatusSchema,
  MeasurementUnitSchema,
  NoSignatureReasonSchema,
  PaymentMethodSchema,
  ServiceSessionStatusSchema,
  StopOutcomeReasonSchema,
} from '../enums';
import { RouteWithStopsSchema } from './route';
import { InventoryBalanceSchema } from './inventory';
import { PaymentSchema } from './cash';

/**
 * docs/spec/03-modulos.md §C.10 "Ejecución de servicios", docs/spec/10-api.md §J.2
 * "App de campo", docs/spec/09-reglas.md R2-R10/R16-R18/R43-R48.
 *
 * Alcance de PR-106b: el resto de `/field/*` que quedó afuera de PR-104/106 (bundle
 * del día, transiciones de stop, ciclo de vida de la sesión, insumos con dilución,
 * firma, pago, cierre con checklist, stock del operario, rendición). Evidencia
 * (`/field/sessions/:id/evidence*`) ya tiene contrato propio desde PR-106
 * (schemas/evidence.ts) — acá no se duplica.
 *
 * `/field/sync` (batch offline con orden causal, R46) queda deliberadamente afuera de
 * este PR: es una pieza de arquitectura propia (ledger de idempotencia, dependencias
 * explícitas entre eventos) que merece su propio diseño, no algo para improvisar
 * dentro de este contrato. Cada endpoint de acá ya lleva `clientEventId` (R43), así
 * que sirve para el caso síncrono (con señal) sin bloquear ese trabajo futuro.
 */

// --- Bundle del día ---

/** Stop enriquecido para la app de campo — RouteStop + lo mínimo de service/tipo para no pedir N+1. */
export const FieldStopSchema = RouteWithStopsSchema.shape.stops.element.extend({
  serviceCode: z.string(),
  serviceStatus: z.string(),
  serviceTypeName: z.string(),
  notesForTechnician: z.string().nullable(),
  priority: z.string(),
});
export type FieldStop = z.infer<typeof FieldStopSchema>;

/** GET /field/today — bundle completo, es lo que el service worker cachea al publicarse la ruta (§J.2). */
export const FieldTodayResponseSchema = z.object({
  route: RouteWithStopsSchema.omit({ stops: true }).nullable(), // null = sin ruta publicada hoy
  stops: z.array(FieldStopSchema),
  myStock: z.array(InventoryBalanceSchema),
});
export type FieldTodayResponse = z.infer<typeof FieldTodayResponseSchema>;

// --- Eventos de GPS en un stop (R47: el GPS nunca bloquea) ---

export const StopGpsEventRequestSchema = z.object({
  occurredAt: z.string().datetime(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  gpsStatus: GpsStatusSchema,
  clientEventId: z.string().uuid(),
});
export type StopGpsEventRequest = z.infer<typeof StopGpsEventRequestSchema>;

/** POST /field/stops/:id/no-show · /field/stops/:id/inaccessible (R9). */
export const StopOutcomeRequestSchema = z.object({
  reason: StopOutcomeReasonSchema,
  evidenceIds: z.array(z.string().uuid()).default([]),
  occurredAt: z.string().datetime(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  clientEventId: z.string().uuid(),
});
export type StopOutcomeRequest = z.infer<typeof StopOutcomeRequestSchema>;

// --- Sesión de servicio ---

export const ServiceSessionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  routeStopId: z.string().uuid(),
  technicianId: z.string().uuid(),
  status: ServiceSessionStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().optional(),
  startLat: z.number().nullable().optional(),
  startLng: z.number().nullable().optional(),
  startAccuracyM: z.number().nullable().optional(),
  endLat: z.number().nullable().optional(),
  endLng: z.number().nullable().optional(),
  endAccuracyM: z.number().nullable().optional(),
  pausedIntervals: z.array(z.object({ pausedAt: z.string().datetime(), resumedAt: z.string().datetime().nullable() })),
  closureChecklist: z.record(z.string(), z.unknown()).nullable().optional(),
  clientSignatureUrl: z.string().nullable().optional(),
  signerName: z.string().nullable().optional(),
  signerIdNumber: z.string().nullable().optional(),
  noSignatureReason: NoSignatureReasonSchema.nullable().optional(),
  technicianNotes: z.string().nullable().optional(),
  reopenedCount: z.number().int().nonnegative(),
  autoClosed: z.boolean(),
});
export type ServiceSession = z.infer<typeof ServiceSessionSchema>;

/** POST /field/services/:id/start (R2: solo el operario asignado, ruta PUBLISHED/IN_PROGRESS). */
export const StartSessionRequestSchema = z.object({
  occurredAt: z.string().datetime(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  gpsStatus: GpsStatusSchema,
  clientEventId: z.string().uuid(),
});
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export const SessionActionRequestSchema = z.object({
  occurredAt: z.string().datetime(),
  clientEventId: z.string().uuid(),
});
export type SessionActionRequest = z.infer<typeof SessionActionRequestSchema>;

// --- Insumos con dilución (R16-R18) ---

export const ServiceSupplyUsageSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  serviceSessionId: z.string().uuid(),
  supplyId: z.string().uuid(),
  lotId: z.string().uuid().nullable().optional(),
  quantityApplied: z.number(),
  unit: MeasurementUnitSchema,
  isDilutedMix: z.boolean(),
  concentrateEquivalent: z.number(),
  applicationMethod: ApplicationMethodSchema,
  treatedAreaSqm: z.number().nullable().optional(),
  clientEventId: z.string().uuid(),
});
export type ServiceSupplyUsage = z.infer<typeof ServiceSupplyUsageSchema>;

/**
 * POST /field/sessions/:id/supplies. Si `isDilutedMix`, `quantityApplied` es la mezcla
 * (litros de solución preparada) y el backend calcula `concentrateEquivalent` con el
 * `dilutionRateMlPerL` del insumo (R18) — el cliente no manda ese cálculo. Si es modo
 * directo (gel/cebo/polvo), `quantityApplied` ya es la cantidad de concentrado 1:1.
 */
export const CreateSupplyUsageRequestSchema = z.object({
  supplyId: z.string().uuid(),
  lotCode: z.string().max(40).nullable().optional(),
  lotId: z.string().uuid().nullable().optional(),
  quantityApplied: z.number().positive(),
  unit: MeasurementUnitSchema,
  isDilutedMix: z.boolean().default(false),
  applicationMethod: ApplicationMethodSchema,
  treatedAreaSqm: z.number().positive().nullable().optional(),
  clientEventId: z.string().uuid(),
});
export type CreateSupplyUsageRequest = z.infer<typeof CreateSupplyUsageRequestSchema>;

// --- Firma ---

/** POST /field/sessions/:id/signature. `clientSignatureUrl` viene de subir la firma como evidencia (type=SIGNATURE) primero. */
export const SessionSignatureRequestSchema = z
  .object({
    clientSignatureUrl: z.string().url().nullable().optional(),
    signerName: z.string().max(150).nullable().optional(),
    signerIdNumber: z.string().max(20).nullable().optional(),
    noSignatureReason: NoSignatureReasonSchema.nullable().optional(),
    clientEventId: z.string().uuid(),
  })
  .refine((v) => !!v.clientSignatureUrl || !!v.noSignatureReason, {
    message: 'Hace falta la firma o un motivo de ausencia de firma (R4).',
  });
export type SessionSignatureRequest = z.infer<typeof SessionSignatureRequestSchema>;

// --- Pago en el momento del servicio ---

/** POST /field/sessions/:id/payment — mismo motor que POST /payments (R24/R25), sin repetir serviceId/customerId (salen de la sesión). */
export const SessionPaymentRequestSchema = z.object({
  amountCents: z.number().int().positive(),
  method: PaymentMethodSchema,
  receiptUrl: z.string().url().nullable().optional(),
  clientEventId: z.string().uuid(),
});
export type SessionPaymentRequest = z.infer<typeof SessionPaymentRequestSchema>;

// --- Cierre (R4) ---

/**
 * POST /field/sessions/:id/finish. El backend valida el checklist server-side (R4) —
 * este body es lo que el operario cargó, no una promesa de que está completo.
 * `paymentDecision` cubre el caso "no corresponde cobro ahora" (cuenta corriente/
 * garantía) sin necesitar un Payment real.
 */
export const FinishSessionRequestSchema = z.object({
  paymentDecision: z.enum(['COLLECTED', 'ACCOUNT_RECEIVABLE', 'NOT_APPLICABLE']),
  technicianNotes: z.string().nullable().optional(),
  occurredAt: z.string().datetime(),
  clientEventId: z.string().uuid(),
});
export type FinishSessionRequest = z.infer<typeof FinishSessionRequestSchema>;

export const FinishSessionResponseSchema = z.object({
  session: ServiceSessionSchema,
  serviceStatus: z.string(),
});
export type FinishSessionResponse = z.infer<typeof FinishSessionResponseSchema>;

// --- Stock del operario y rendición ---

/** GET /field/my-stock — alias de scope 'own' de GET /inventory, para el vehículo del operario. */
export const MyStockResponseSchema = z.array(InventoryBalanceSchema);

/** POST /field/cash/close — alias de campo de POST /cash/accounts/:id/closures sobre la caja propia del operario. */
export const FieldCashCloseRequestSchema = z.object({
  declaredCents: z.number().int().nonnegative(),
});
export type FieldCashCloseRequest = z.infer<typeof FieldCashCloseRequestSchema>;

export { PaymentSchema as FieldPaymentResponseSchema };
