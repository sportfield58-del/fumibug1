import { z } from 'zod';
import { CertificateStatusSchema } from '../enums';

/**
 * docs/spec/03-modulos.md §C.21 (Certificados) + §R33-R38, docs/spec/08-modelo-datos.md
 * §H.2 `certificates`. Contrato propuesto en ADR 0010.
 *
 * Reglas transpuestas acá (el backend las hace cumplir):
 *  - R33: solo se emite sobre un servicio COMPLETED y validado.
 *  - R35: `snapshot` congela el estado al emitir — cambios posteriores en catálogos o
 *    el cliente NO alteran el documento ya emitido (el PDF firmado es inmutable).
 *  - R36: firma solo por el Director Técnico, con matrícula vigente a la fecha del servicio.
 *  - R37: un certificado firmado es inmutable; corregir = anular (void) + emitir uno nuevo.
 *  - R38: la emisión valida que cada producto aplicado tenga registro + lote/conc.
 */
export const CertificateSnapshotSchema = z.object({
  company: z.object({
    legalName: z.string(),
    cuit: z.string(),
    habilitationNumber: z.string(),
    address: z.string(),
    phone: z.string(),
    logoUrl: z.string().nullable().optional(),
  }),
  service: z.object({
    serviceCode: z.string(),
    serviceTypeKey: z.string(),
    serviceTypeName: z.string(),
    scheduledDate: z.string().date(),
    performedAt: z.string().datetime(),
    method: z.string().nullable().optional(),
    targetPests: z.array(z.string()),
    treatedSurfaceSqm: z.number().nonnegative().nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    observations: z.string().nullable().optional(),
  }),
  customer: z.object({
    legalName: z.string(),
    documentId: z.string().nullable().optional(),
  }),
  location: z.object({
    displayAddress: z.string(),
    notes: z.string().nullable().optional(),
  }),
  technician: z.object({
    fullName: z.string(),
    sanitaryLicense: z.string(),
  }),
  technicalDirector: z.object({
    fullName: z.string(),
    licenseNumber: z.string(),
    licenseExpiry: z.string().date(),
  }),
  appliedProducts: z.array(
    z.object({
      productName: z.string(),
      activeIngredient: z.string(),
      concentration: z.string(),
      regulatoryAuthority: z.string(),
      regulatoryNumber: z.string(),
      batchCode: z.string().nullable().optional(),
      dilution: z.string().nullable().optional(),
      quantity: z.string().nullable().optional(),
      reentryHours: z.number().int().nonnegative().nullable().optional(),
    }),
  ),
});
export type CertificateSnapshot = z.infer<typeof CertificateSnapshotSchema>;

export const CertificateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  number: z.number().int().positive(),
  formattedNumber: z.string(),
  serviceId: z.string().uuid(),
  serviceSessionId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  serviceLocationId: z.string().uuid().nullable().optional(),
  technicalDirectorId: z.string().uuid(),
  technicianId: z.string().uuid().nullable().optional(),
  status: CertificateStatusSchema,
  snapshot: CertificateSnapshotSchema,
  pdfStoragePath: z.string().nullable().optional(),
  verificationToken: z.string().uuid().nullable().optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),
  voidedAt: z.string().datetime().nullable().optional(),
  voidReason: z.string().nullable().optional(),
  replacesCertificateId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Certificate = z.infer<typeof CertificateSchema>;

export const CertificateListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: CertificateStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export type CertificateListQuery = z.infer<typeof CertificateListQuerySchema>;

export const CreateCertificateRequestSchema = z.object({
  serviceId: z.string().uuid(),
  technicalDirectorId: z.string().uuid().optional(),
});
export type CreateCertificateRequest = z.infer<typeof CreateCertificateRequestSchema>;

export const CreateCertificateBatchRequestSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1).max(50),
  technicalDirectorId: z.string().uuid().optional(),
});
export type CreateCertificateBatchRequest = z.infer<typeof CreateCertificateBatchRequestSchema>;

export const VoidCertificateRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type VoidCertificateRequest = z.infer<typeof VoidCertificateRequestSchema>;

export const SendCertificateRequestSchema = z.object({
  email: z.string().email().optional(),
  whatsapp: z.string().optional(),
});
export type SendCertificateRequest = z.infer<typeof SendCertificateRequestSchema>;

export const CertificatePdfUrlSchema = z.object({ url: z.string() });
export type CertificatePdfUrl = z.infer<typeof CertificatePdfUrlSchema>;

export const SendCertificateResultSchema = z.object({ ok: z.boolean() });
export type SendCertificateResult = z.infer<typeof SendCertificateResultSchema>;

export const CertificateBatchResultSchema = z.object({
  created: z.array(CertificateSchema),
  failed: z.array(
    z.object({
      serviceId: z.string().uuid(),
      error: z.object({ code: z.string(), message: z.string() }),
    }),
  ),
});
export type CertificateBatchResult = z.infer<typeof CertificateBatchResultSchema>;

export const CertificateVerifyResultSchema = z.object({
  formattedNumber: z.string(),
  issuedAt: z.string().datetime().nullable().optional(),
  customerName: z.string(),
  status: CertificateStatusSchema,
});
export type CertificateVerifyResult = z.infer<typeof CertificateVerifyResultSchema>;
