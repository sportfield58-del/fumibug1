import { z } from 'zod';
import {
  CancellationReasonSchema,
  ServiceOriginSchema,
  ServicePrioritySchema,
  ServiceStatusSchema,
} from '../enums';

/**
 * docs/spec/03-modulos.md §C.6, docs/spec/08-modelo-datos.md §H.2 `services`,
 * docs/spec/04-estados.md §D.3 (transiciones — implementadas en
 * apps/api/src/common/state-machine/definitions.ts, `SERVICE_TRANSITIONS`).
 *
 * `priceCents` en centavos (CLAUDE.md §4). `version` para concurrencia optimista —
 * PATCH/acciones requieren header `If-Match: <version>` (docs/spec/10-api.md §J.1).
 */
export const ServiceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  code: z.string().min(1).max(20),
  customerId: z.string().uuid(),
  serviceLocationId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  contractId: z.string().uuid().nullable().optional(),
  parentServiceId: z.string().uuid().nullable().optional(),
  origin: ServiceOriginSchema,
  status: ServiceStatusSchema,
  targetPests: z.array(z.string()),
  scheduledDate: z.string().date().nullable().optional(),
  windowStart: z.string().nullable().optional(), // HH:mm:ss
  windowEnd: z.string().nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
  requiredTechnicians: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  priceListId: z.string().uuid().nullable().optional(),
  isWarrantyVisit: z.boolean(),
  warrantyUntil: z.string().date().nullable().optional(),
  priority: ServicePrioritySchema,
  notesInternal: z.string().nullable().optional(),
  notesForTechnician: z.string().nullable().optional(),
  cancellationReason: CancellationReasonSchema.nullable().optional(),
  cancelledBillable: z.boolean().nullable().optional(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Service = z.infer<typeof ServiceSchema>;

// --- Listas ---

/** GET /services?status=&from=&to=&customerId=&technicianId=&unassigned=true (§J.2). */
export const ServiceListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: ServiceStatusSchema.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  customerId: z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
});
export type ServiceListQuery = z.infer<typeof ServiceListQuerySchema>;

// --- Alta / edición ---

/**
 * POST /services — alta manual (origin queda MANUAL en el backend; ORIGIN por contrato
 * o revisita de garantía los generan otros flujos, no este endpoint directo).
 */
export const CreateServiceRequestSchema = z.object({
  customerId: z.string().uuid(),
  serviceLocationId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  targetPests: z.array(z.string()).default([]),
  scheduledDate: z.string().date().nullable().optional(),
  windowStart: z.string().nullable().optional(),
  windowEnd: z.string().nullable().optional(),
  estimatedDurationMinutes: z.number().int().positive().nullable().optional(),
  requiredTechnicians: z.number().int().positive().default(1),
  priceCents: z.number().int().nonnegative(),
  priceListId: z.string().uuid().nullable().optional(),
  priority: ServicePrioritySchema.default('NORMAL'),
  notesInternal: z.string().nullable().optional(),
  notesForTechnician: z.string().nullable().optional(),
});
export type CreateServiceRequest = z.infer<typeof CreateServiceRequestSchema>;

/** PATCH /services/:id — requiere If-Match. No cambia customerId/status (eso son acciones aparte). */
export const UpdateServiceRequestSchema = CreateServiceRequestSchema.omit({ customerId: true }).partial();
export type UpdateServiceRequest = z.infer<typeof UpdateServiceRequestSchema>;

// --- Acciones de transición (§J.2) ---

export const CancelServiceRequestSchema = z.object({
  reason: CancellationReasonSchema,
  billable: z.boolean().default(false),
});
export type CancelServiceRequest = z.infer<typeof CancelServiceRequestSchema>;

export const RescheduleServiceRequestSchema = z.object({
  newDate: z.string().date(),
  reason: z.string().min(1).max(300),
});
export type RescheduleServiceRequest = z.infer<typeof RescheduleServiceRequestSchema>;

export const RejectServiceRequestSchema = z.object({
  reason: z.string().min(1).max(300),
});
export type RejectServiceRequest = z.infer<typeof RejectServiceRequestSchema>;

export const ReopenServiceRequestSchema = z.object({
  reason: z.string().min(1).max(300),
});
export type ReopenServiceRequest = z.infer<typeof ReopenServiceRequestSchema>;
