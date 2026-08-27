import { z } from 'zod';
import { EvidenceCategorySchema, EvidenceTypeSchema } from '../enums';

/**
 * docs/spec/03-modulos.md §C.11. Compresión client-side, upload directo a Storage con
 * URL firmada, cola offline (docs/spec/12-offline-pwa.md). **Sin EXIF de ubicación** — se
 * strippea client-side y se guarda lat/lng por separado (columnas propias, no en el
 * archivo). `clientEventId` para idempotencia (CLAUDE.md invariante #8).
 */
export const ServiceEvidenceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  serviceSessionId: z.string().uuid(),
  type: EvidenceTypeSchema,
  category: EvidenceCategorySchema,
  storagePath: z.string().min(1),
  mimeType: z.string().max(100).nullable().optional(),
  sizeBytes: z.number().int().positive().max(8388608).nullable().optional(), // CHECK size_bytes <= 8MB en Postgres
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  sha256: z.string().length(64).nullable().optional(),
  takenAt: z.string().datetime().nullable().optional(),
  uploadedAt: z.string().datetime(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  accuracyM: z.number().nullable().optional(),
  clientEventId: z.string().uuid(),
});
export type ServiceEvidence = z.infer<typeof ServiceEvidenceSchema>;

/** POST /field/sessions/:id/evidence/upload-url — URL firmada de Supabase Storage. */
export const UploadEvidenceUrlRequestSchema = z.object({
  category: EvidenceCategorySchema,
  type: EvidenceTypeSchema,
  mimeType: z.string().max(100),
});
export type UploadEvidenceUrlRequest = z.infer<typeof UploadEvidenceUrlRequestSchema>;

export const UploadEvidenceUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storagePath: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type UploadEvidenceUrlResponse = z.infer<typeof UploadEvidenceUrlResponseSchema>;

/** POST /field/sessions/:id/evidence — confirma la subida y crea el registro. */
export const ConfirmEvidenceRequestSchema = z.object({
  storagePath: z.string().min(1),
  category: EvidenceCategorySchema,
  type: EvidenceTypeSchema,
  mimeType: z.string().max(100).nullable().optional(),
  sizeBytes: z.number().int().positive().max(8388608).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  sha256: z.string().length(64).nullable().optional(),
  takenAt: z.string().datetime().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  accuracyM: z.number().nullable().optional(),
  clientEventId: z.string().uuid(),
});
export type ConfirmEvidenceRequest = z.infer<typeof ConfirmEvidenceRequestSchema>;
