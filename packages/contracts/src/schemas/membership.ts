import { z } from 'zod';
import { MembershipStatusSchema } from '../enums';

/** docs/spec/08-modelo-datos.md §H.2 `memberships`. UNIQUE(tenant_id, user_id). */
export const MembershipSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  status: MembershipStatusSchema,
  joinedAt: z.string().datetime(),
});
export type Membership = z.infer<typeof MembershipSchema>;
