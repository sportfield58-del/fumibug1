import { z } from 'zod';

/** docs/spec/08-modelo-datos.md §H.2 `users`. Sin tenant_id: la relación va por membership. */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(1).max(40).nullable().optional(),
  fullName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;
