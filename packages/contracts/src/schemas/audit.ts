import { z } from 'zod';
import { AuditSeveritySchema } from '../enums';

/**
 * docs/spec/03-modulos.md §C.20, docs/spec/11-seguridad.md §K.10. Append-only — nunca
 * UPDATE/DELETE (CLAUDE.md invariante #2, trigger de Postgres R42). `id` es BIGINT
 * autoincremental en la base; acá viaja como string para no perder precisión en JSON.
 */
export const AuditLogSchema = z.object({
  id: z.string(), // BigInt serializado
  tenantId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable().optional(),
  actorRole: z.string().max(40).nullable().optional(),
  action: z.string().min(1).max(60),
  entityType: z.string().min(1).max(60),
  entityId: z.string().uuid().nullable().optional(),
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  diff: z.unknown().nullable().optional(),
  severity: AuditSeveritySchema,
  ip: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  requestId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

/** GET /audit-logs — cursor-paginado, alto volumen (docs/spec/10-api.md §J.1). */
export const AuditLogListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entityType: z.string().max(60).optional(),
  entityId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  severity: AuditSeveritySchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type AuditLogListQuery = z.infer<typeof AuditLogListQuerySchema>;
