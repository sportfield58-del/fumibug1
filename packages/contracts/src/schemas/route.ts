import { z } from 'zod';
import { GpsStatusSchema, RouteStatusSchema, RouteStopStatusSchema, StopOutcomeReasonSchema } from '../enums';

/**
 * docs/spec/03-modulos.md §C.7/§C.8, docs/spec/04-estados.md §D.4/§D.5,
 * docs/spec/08-modelo-datos.md §H.2 `routes`/`route_stops`.
 */
export const RouteStopSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  routeId: z.string().uuid(),
  serviceId: z.string().uuid(),
  sequence: z.number().int().positive(),
  status: RouteStopStatusSchema,
  eta: z.string().nullable().optional(), // HH:mm:ss
  travelMinutes: z.number().int().nonnegative().nullable().optional(), // MVP: manual (Fase 2: Distance Matrix)
  enRouteAt: z.string().datetime().nullable().optional(),
  arrivedAt: z.string().datetime().nullable().optional(),
  arrivalLat: z.number().nullable().optional(),
  arrivalLng: z.number().nullable().optional(),
  arrivalAccuracyM: z.number().nullable().optional(),
  gpsStatus: GpsStatusSchema.nullable().optional(),
  distanceFromLocationM: z.number().int().nonnegative().nullable().optional(),
  outcomeReason: StopOutcomeReasonSchema.nullable().optional(),
  wastedTrip: z.boolean(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /**
   * Solo en GET /routes/:id (§J.2) — datos del destino del stop, para mostrar el
   * mapa estático de paradas del Planificador (no es tracking en vivo, ver
   * docs/spec/19-mvp-roadmap.md: "Técnicamente imposible en PWA"). `lat`/`lng` nulos
   * cuando el domicilio del cliente no está geocodificado todavía.
   */
  location: z
    .object({
      customerName: z.string(),
      addressLine: z.string(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
    })
    .nullable()
    .optional(),
});
export type RouteStop = z.infer<typeof RouteStopSchema>;

export const RouteSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  code: z.string().min(1).max(20),
  technicianId: z.string().uuid(),
  vehicleId: z.string().uuid().nullable().optional(),
  routeDate: z.string().date(),
  status: RouteStatusSchema,
  publishedAt: z.string().datetime().nullable().optional(),
  publishedBy: z.string().uuid().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Route = z.infer<typeof RouteSchema>;

/** GET /routes/:id — con stops ordenados (§J.2). */
export const RouteWithStopsSchema = RouteSchema.extend({
  stops: z.array(RouteStopSchema),
});
export type RouteWithStops = z.infer<typeof RouteWithStopsSchema>;

// --- Listas ---

export const RouteListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  date: z.string().date().optional(),
  technicianId: z.string().uuid().optional(),
  status: RouteStatusSchema.optional(),
});
export type RouteListQuery = z.infer<typeof RouteListQuerySchema>;

// --- Alta / edición ---

export const CreateRouteRequestSchema = z.object({
  technicianId: z.string().uuid(),
  date: z.string().date(),
  vehicleId: z.string().uuid().nullable().optional(),
});
export type CreateRouteRequest = z.infer<typeof CreateRouteRequestSchema>;

export const UpdateRouteRequestSchema = z.object({
  vehicleId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateRouteRequest = z.infer<typeof UpdateRouteRequestSchema>;

export const AddStopRequestSchema = z.object({
  serviceId: z.string().uuid(),
  travelMinutes: z.number().int().nonnegative().nullable().optional(),
});
export type AddStopRequest = z.infer<typeof AddStopRequestSchema>;

/** PUT /routes/:id/stops/order — reordena en una transacción (R13). */
export const ReorderStopsRequestSchema = z.object({
  stopIds: z.array(z.string().uuid()).min(1),
});
export type ReorderStopsRequest = z.infer<typeof ReorderStopsRequestSchema>;

export const ReassignRouteRequestSchema = z.object({
  newTechnicianId: z.string().uuid(),
});
export type ReassignRouteRequest = z.infer<typeof ReassignRouteRequestSchema>;

/**
 * POST /routes/:id/validate — dry-run de los guards de publicación (R12/R15), sin
 * publicar. `blockers` impide publicar (ej. libreta vencida — R15, bloqueo duro);
 * `warnings` no impide (ej. solapamiento horario, ventana del cliente violada, stock
 * insuficiente — §C.7: "no bloquea, advierte").
 */
export const RouteValidationIssueSchema = z.object({
  code: z.string(), // ROUTE_TECHNICIAN_LICENSE_EXPIRED, ROUTE_STOP_TIME_OVERLAP, etc. — catálogo en ErrorCode
  message: z.string(),
  stopId: z.string().uuid().nullable().optional(),
});
export type RouteValidationIssue = z.infer<typeof RouteValidationIssueSchema>;

export const RouteValidationResponseSchema = z.object({
  canPublish: z.boolean(),
  blockers: z.array(RouteValidationIssueSchema),
  warnings: z.array(RouteValidationIssueSchema),
});
export type RouteValidationResponse = z.infer<typeof RouteValidationResponseSchema>;
