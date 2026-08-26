import { z } from 'zod';
import { TenantPlanSchema, TenantStatusSchema } from '../enums';

/** docs/spec/08-modelo-datos.md §H.2 `tenants`. Wire format en camelCase (ver docs/spec/10-api.md §J.3). */
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(60),
  legalName: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  healthAuthorizationNumber: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  timezone: z.string(),
  plan: TenantPlanSchema,
  status: TenantStatusSchema,
  settings: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;
