import { z } from 'zod';
import { ServiceStatusSchema } from '../enums';

/**
 * docs/spec/03-modulos.md §C.1. Dashboard distinto por rol — el operario no tiene
 * dashboard (entra directo a su ruta del día, ver /field/today en PR-207+).
 */
export const DashboardAlertSchema = z.object({
  type: z.enum(['LOW_STOCK', 'LICENSE_EXPIRING', 'PENDING_CLOSURE', 'UNSIGNED_CERTIFICATE']),
  message: z.string(),
  entityId: z.string().uuid().nullable().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
});
export type DashboardAlert = z.infer<typeof DashboardAlertSchema>;

/** GET /reports/dashboard-admin (o el key que defina docs/spec/10-api.md §J.2 "Reportes"). */
export const AdminDashboardResponseSchema = z.object({
  servicesTodayByStatus: z.record(ServiceStatusSchema, z.number().int().nonnegative()),
  activeTechniciansCount: z.number().int().nonnegative(),
  unassignedServicesCount: z.number().int().nonnegative(),
  alerts: z.array(DashboardAlertSchema),
  collectedTodayCashCents: z.number().int().nonnegative(),
  collectedTodayTransferCents: z.number().int().nonnegative(),
});
export type AdminDashboardResponse = z.infer<typeof AdminDashboardResponseSchema>;

/** Owner: "los 4 números del negocio" (§C.1) — vista de alto nivel, sin operativa día a día. */
export const OwnerDashboardResponseSchema = z.object({
  billedThisMonthCents: z.number().int().nonnegative(),
  cashPendingReconciliationCents: z.number().int().nonnegative(),
  completedServicesThisMonth: z.number().int().nonnegative(),
  averageTicketCents: z.number().int().nonnegative(),
});
export type OwnerDashboardResponse = z.infer<typeof OwnerDashboardResponseSchema>;
