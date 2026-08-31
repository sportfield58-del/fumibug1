# ADR 0010 — Propuesta de contrato: Certificados (C.21) y Reportes (§P)

**Estado:** Propuesto (OpenCode) · 2026-08-31 — a la espera de que Claude Code lo
implemente en `packages/contracts` (estos archivos son suyos; este ADR es el pedido de
cambio de contrato, `contract-change`).

## Contexto

El humano pidió avanzar con las pantallas de **Certificados** y **Reportes**. Ambas
están bloqueadas por contrato (AGENTS §4: OpenCode no inventa tipos de la API):

- **Certificados** es MUST HAVE y el diferencial #1 (`docs/spec/00-overview.md`,
  `03-modulos.md §C.21`, aceptación `W.6` en `18-aceptacion.md`). La spec define el
  modelo (`08-modelo-datos.md` §`certificates`) y los endpoints (`10-api.md`), y ya
  existen los permisos `certificate.read/issue/sign/void` (`permissions.ts`) y el enum
  `CertificateStatus` (`DRAFT/ISSUED/SIGNED/VOIDED`, `enums.ts`). Pero **ningún
  endpoint ni schema de certificado** existe en `packages/contracts`.
- **Reportes** (`19-mvp-roadmap.md` lista 8 reportes; §P de inventario/caja en
  `13-inventario-caja.md`) — el client solo expone los 2 dashboards
  (`reports/dashboard-admin`, `reports/dashboard-owner`). No hay endpoint de reportes.

Este ADR fija la **forma exacta** que propone OpenCode, para que Claude Code lo
implemente de una. Se sigue el estilo de los schemas (`schemas/*.ts`) y endpoints
(`endpoints.ts`) ya existentes.

## Decisión — Contratos de Certificados

### Schemas (nuevo archivo `packages/contracts/src/schemas/certificate.ts`)

```ts
import { z } from 'zod';
import { CertificateStatusSchema } from '../enums';

// Base (solo lectura). Congela todo al emitir (R35): luego, cambios en catálogos no
// alteran el documento.
export const CertificateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  number: z.number().int().positive(),               // correlativo INT
  formattedNumber: z.string(),                         // ej. "CERT-2026-00187"
  serviceId: z.string().uuid(),
  serviceSessionId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid(),
  serviceLocationId: z.string().uuid(),
  technicalDirectorId: z.string().uuid(),
  technicianId: z.string().uuid(),
  status: CertificateStatusSchema,                     // DRAFT | ISSUED | SIGNED | VOIDED
  snapshot: CertificateSnapshotSchema,                 // R35
  pdfStoragePath: z.string().nullable().optional(),
  verificationToken: z.string().uuid().nullable().optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),
  voidedAt: z.string().datetime().nullable().optional(),
  voidReason: z.string().nullable().optional(),
  replacesCertificateId: z.string().uuid().nullable().optional(), // R37: corrección
});
export type Certificate = z.infer<typeof CertificateSchema>;

// Snapshot (R35): congela empresa, servicio, cliente, domicilio, insumos, DT.
export const CertificateSnapshotSchema = z.object({
  company: z.object({
    legalName: z.string(), cuit: z.string(), habilitationNumber: z.string(),
    address: z.string(), phone: z.string(), logoUrl: z.string().nullable().optional(),
  }),
  service: z.object({
    serviceCode: z.string(), serviceTypeKey: z.string(), serviceTypeName: z.string(),
    scheduledDate: z.string().date(), performedAt: z.string().datetime(),
    method: z.string().nullable().optional(), targetPests: z.array(z.string()),
    treatedSurfaceSqm: z.number().nonnegative().nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    observations: z.string().nullable().optional(),
  }),
  customer: z.object({ legalName: z.string(), documentId: z.string().nullable().optional() }),
  location: z.object({ displayAddress: z.string(), notes: z.string().nullable().optional() }),
  technician: z.object({ fullName: z.string(), sanitaryLicense: z.string() }),
  technicalDirector: z.object({
    fullName: z.string(), licenseNumber: z.string(), licenseExpiry: z.string().date(),
  }),
  appliedProducts: z.array(z.object({
    productName: z.string(), activeIngredient: z.string(), concentration: z.string(),
    regulatoryAuthority: z.string(), regulatoryNumber: z.string(),       // ANMAT/SENASA
    batchCode: z.string().nullable().optional(), dilution: z.string().nullable().optional(),
    quantity: z.string().nullable().optional(), reentryHours: z.number().int().nonnegative().nullable().optional(),
  })),
});
export type CertificateSnapshot = z.infer<typeof CertificateSnapshotSchema>;

export const CertificateListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: CertificateStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  from: z.string().date().optional(),   // issuedAt >= from
  to: z.string().date().optional(),
});
export type CertificateListQuery = z.infer<typeof CertificateListQuerySchema>;

// POST /certificates — R33: solo sobre un servicio COMPLETED y validado.
export const CreateCertificateRequestSchema = z.object({
  serviceId: z.string().uuid(),
  technicalDirectorId: z.string().uuid().optional(), // default: DT vigente del tenant
});
export type CreateCertificateRequest = z.infer<typeof CreateCertificateRequestSchema>;

// POST /certificates/batch — emisión en lote.
export const CreateCertificateBatchRequestSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1).max(50),
  technicalDirectorId: z.string().uuid().optional(),
});
export type CreateCertificateBatchRequest = z.infer<typeof CreateCertificateBatchRequestSchema>;

// POST /certificates/:id/void — R37: documento firmado inmutable; corregir = anular + nuevo.
export const VoidCertificateRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type VoidCertificateRequest = z.infer<typeof VoidCertificateRequestSchema>;
```

### Endpoints (agregar a `packages/contracts/src/endpoints.ts`)

| id | method/path | request | response | permiso |
|---|---|---|---|---|
| `listCertificates` | GET `/certificates` | query `CertificateListQuerySchema` | `z.array(CertificateSchema)` | `certificate.read` |
| `createCertificate` | POST `/certificates` | `{body: CreateCertificateRequest}` | `CertificateSchema` | `certificate.issue` |
| `createCertificateBatch` | POST `/certificates/batch` | `{body: CreateCertificateBatchRequest}` | `z.object({ created: z.array(CertificateSchema), failed: z.array(z.object({ serviceId: z.string().uuid(), error: z.object({ code: z.string(), message: z.string() }) })) })` | `certificate.issue` |
| `signCertificate` | POST `/certificates/:id/sign` | — | `CertificateSchema` | `certificate.sign` (R36: solo DT, matrícula vigente a la fecha del servicio) |
| `voidCertificate` | POST `/certificates/:id/void` | `{body: VoidCertificateRequest}` | `CertificateSchema` | `certificate.void` |
| `getCertificatePdf` | GET `/certificates/:id/pdf` | — | `z.object({ url: z.string() })` (URL firmada TTL 5 min) | `certificate.read` |
| `sendCertificate` | POST `/certificates/:id/send` | `{body: { email?: z.string().email().optional(), whatsapp?: z.string().optional() }}` | `z.object({ ok: z.boolean() })` | `certificate.read` |
| `getCertificateVerify` | GET `/public/verify/:token` | — | `z.object({ formattedNumber, issuedAt: z.string().datetime(), customerName: z.string(), status: CertificateStatusSchema })` — sin auth, rate-limited (`11-seguridad.md`; expone solo número, fecha, cliente y estado) | público |

Errores (`errors.ts`): `CERTIFICATE_INVALID_SERVICE` (servicio no COMPLETED, R33),
`CERTIFICATE_DT_INVALID_LICENSE` (R36), `CERTIFICATE_FIRMWARE_LOCKED` (R37, 422),
`CERTIFICATE_INCOMPLETE_PRODUCT` (R38 — señala qué producto carece de registro/lote),
`CERTIFICATE_ALREADY_EXISTS` (servicio ya emitió).

## Decisión — Contratos de Reportes

El client ya tiene `GET /reports/dashboard-admin` y `GET /reports/dashboard-owner`
(usados en `/admin`). Para no duplicar lógica y cubrir los 8 reportes del roadmap, se
propone **un endpoint único paginado por tipo**, no 8 endpoints hardcodeados:

```ts
// Nuevo schema reports.ts
export const REPORT_TYPE = ['services_by_status', 'productivity_by_technician',
  'revenue_by_period', 'collected_by_method', 'supply_consumption',
  'stock_current', 'settlements', 'certificates_issued'] as const;
export const ReportTypeSchema = z.enum(REPORT_TYPE);

export const ReportQuerySchema = z.object({
  type: ReportTypeSchema,
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  technicianId: z.string().uuid().optional(),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

// Respuesta: filas tipadas por un union discriminated por `type`.
export const ReportRowSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('services_by_status'), status: z.string(), count: z.number().int() }),
  z.object({ type: z.literal('productivity_by_technician'), technicianId: z.string().uuid(), technicianName: z.string(), servicesDone: z.number().int(), avgMinutes: z.number().nullable().optional() }),
  z.object({ type: z.literal('revenue_by_period'), period: z.string(), totalCents: z.number().int().nullable().optional() }),
  z.object({ type: z.literal('collected_by_method'), method: z.string(), totalCents: z.number().int() }),
  z.object({ type: z.literal('supply_consumption'), supplyId: z.string().uuid(), supplyName: z.string(), quantityApplied: z.number() }),
  z.object({ type: z.literal('stock_current'), supplyId: z.string().uuid(), supplyName: z.string(), stockLocation: z.string(), balance: z.number() }),
  z.object({ type: z.literal('settlements'), accountId: z.string().uuid().optional(), declaredCents: z.number().int(), reconciled: z.boolean() }),
  z.object({ type: z.literal('certificates_issued'), period: z.string(), count: z.number().int() }),
]);
export type ReportRow = z.infer<typeof ReportRowSchema>;

export const ReportResponseSchema = z.object({ rows: z.array(ReportRowSchema) });
export type ReportResponse = z.infer<typeof ReportResponseSchema>;
```

Endpoints:

| id | method/path | request | response |
|---|---|---|---|
| `getReport` | GET `/reports` | query `ReportQuerySchema` | `ReportResponseSchema` |

Permisos: los reportes heredan los de cada dominio (`service.read` para
`services_by_status`/`productivity`, `payment.read` + `cash.read` para
`collected_by_method`/`settlements`, `inventory.read` para consumo/stock,
`certificate.read` para `certificates_issued`). Para simplificar el MVP se admite un
único `@RequirePermission('settings.manage')` con los roles typicos de reportes, a
decisión de Claude Code; el front no depende de esa elección.

## Consecuencias

- OpenCode construye `/admin/certificados` y `/admin/reportes` en cuanto estos
  contratos existan y `pnpm generate` los materialice en mocks. El ADR-10 fija la forma,
  no improvisa.
- `certificates.snapshot` (R35) y `appliedProducts` (R38) son la columna vertebral del
  PDF; si falta un campo al emitir, el backend responde `CERTIFICATE_INCOMPLETE_PRODUCT`
  con el detalle.
- `Reopen` (ya implementado en el servicio, PR-208) anula el certificado si existe
  (`04-estados.md`), y debe reflejarse en `replacesCertificateId`/`voidedAt`.
- Este contrato no inventa reglas: transpone `C.21`, `R33-R38`, `W.6` y `10-api.md`.
- Si Claude Code cambia nombres/campos al implementar, actualiza este ADR; el front se
  adapta al contrato generado (AGENTS §4 lo garantiza).
