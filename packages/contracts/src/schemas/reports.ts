import { z } from 'zod';

/**
 * docs/spec/19-mvp-roadmap.md (8 reportes) + §P de inventario/caja en
 * docs/spec/13-inventario-caja.md. Contrato propuesto en ADR 0010: un único endpoint
 * paginado por `type`, con filas tipadas por unión discriminada — en vez de 8 endpoints
 * hardcodeados.
 */
export const REPORT_TYPE = [
  'services_by_status',
  'productivity_by_technician',
  'revenue_by_period',
  'collected_by_method',
  'supply_consumption',
  'stock_current',
  'settlements',
  'certificates_issued',
] as const;
export const ReportTypeSchema = z.enum(REPORT_TYPE);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportQuerySchema = z.object({
  type: ReportTypeSchema,
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  technicianId: z.string().uuid().optional(),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const ReportRowSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('services_by_status'),
    status: z.string(),
    count: z.number().int(),
  }),
  z.object({
    type: z.literal('productivity_by_technician'),
    technicianId: z.string().uuid(),
    technicianName: z.string(),
    servicesDone: z.number().int(),
    avgMinutes: z.number().nullable().optional(),
  }),
  z.object({
    type: z.literal('revenue_by_period'),
    period: z.string(),
    totalCents: z.number().int().nullable().optional(),
  }),
  z.object({
    type: z.literal('collected_by_method'),
    method: z.string(),
    totalCents: z.number().int(),
  }),
  z.object({
    type: z.literal('supply_consumption'),
    supplyId: z.string().uuid(),
    supplyName: z.string(),
    quantityApplied: z.number(),
  }),
  z.object({
    type: z.literal('stock_current'),
    supplyId: z.string().uuid(),
    supplyName: z.string(),
    stockLocation: z.string(),
    balance: z.number(),
  }),
  z.object({
    type: z.literal('settlements'),
    accountId: z.string().uuid().optional(),
    declaredCents: z.number().int(),
    reconciled: z.boolean(),
  }),
  z.object({
    type: z.literal('certificates_issued'),
    period: z.string(),
    count: z.number().int(),
  }),
]);
export type ReportRow = z.infer<typeof ReportRowSchema>;

export const ReportResponseSchema = z.object({ rows: z.array(ReportRowSchema) });
export type ReportResponse = z.infer<typeof ReportResponseSchema>;
