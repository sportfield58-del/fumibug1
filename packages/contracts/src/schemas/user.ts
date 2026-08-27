import { z } from 'zod';
import { LicenseTypeSchema, MembershipStatusSchema } from '../enums';
import { PaginationMetaSchema } from '../responses';
import { TechnicianProfileSchema } from './technician-profile';

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

/**
 * GET /users, GET /users/:id — usuario tal como lo ve el admin: su membership en este
 * tenant (rol, estado) y, si es operario o DT, su ficha técnica. docs/spec/03-modulos.md
 * §C.2.
 */
export const UserWithMembershipSchema = UserSchema.extend({
  membershipStatus: MembershipStatusSchema,
  roleId: z.string().uuid(),
  roleKey: z.string(),
  roleName: z.string(),
  technicianProfile: TechnicianProfileSchema.nullable().optional(),
});
export type UserWithMembership = z.infer<typeof UserWithMembershipSchema>;

export const UserListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  roleKey: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).max(120).optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const UserListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(UserWithMembershipSchema),
  meta: PaginationMetaSchema,
});
export type UserListResponse = z.infer<typeof UserListResponseSchema>;

/**
 * POST /users — docs/spec/11-seguridad.md §K.1: un operario no tiene email real, se le
 * genera `{username}@{tenant-slug}.fumibug.internal` en el backend; acá solo pide
 * `username`. Si `roleKey` corresponde a un rol de operario/DT, `technicianProfile` es
 * obligatorio (se valida en el backend contra el catálogo de roles del tenant, no acá:
 * el contrato no conoce qué rol es "de campo").
 */
export const CreateUserRequestSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(40).optional(),
  fullName: z.string().min(1).max(150),
  phone: z.string().max(40).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  roleId: z.string().uuid(),
  technicianProfile: z
    .object({
      licenseNumber: z.string().max(60).nullable().optional(),
      licenseType: LicenseTypeSchema,
      licenseExpiresAt: z.string().date().nullable().optional(),
      vehicleId: z.string().uuid().nullable().optional(),
      stockLocationId: z.string().uuid().nullable().optional(),
    })
    .optional(),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

/** POST /users — respuesta incluye el PIN o password temporal, mostrado una sola vez. */
export const CreateUserResponseSchema = z.object({
  user: UserWithMembershipSchema,
  temporaryPin: z.string().length(6).nullable().optional(),
});
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

/** PATCH /users/:id — requiere `If-Match`. No cambia email/username ni rol (eso es un endpoint aparte). */
export const UpdateUserRequestSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  phone: z.string().max(40).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  technicianProfile: z
    .object({
      licenseNumber: z.string().max(60).nullable().optional(),
      licenseExpiresAt: z.string().date().nullable().optional(),
      vehicleId: z.string().uuid().nullable().optional(),
      stockLocationId: z.string().uuid().nullable().optional(),
    })
    .optional(),
});
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

/** POST /users/:id/deactivate y POST /users/:id/activate — sin body, toggle explícito. */
export const SetUserActiveRequestSchema = z.object({
  reason: z.string().max(300).optional(),
});
export type SetUserActiveRequest = z.infer<typeof SetUserActiveRequestSchema>;

/** POST /users/:id/reset-pin — solo tiene sentido para cuentas de operario (username, sin email real). */
export const ResetPinResponseSchema = z.object({
  temporaryPin: z.string().length(6),
});
export type ResetPinResponse = z.infer<typeof ResetPinResponseSchema>;

/** POST /users/:id/force-logout — revoca todos los refresh tokens activos del usuario. */
export const ForceLogoutResponseSchema = z.object({
  revokedSessions: z.number().int().nonnegative(),
});
export type ForceLogoutResponse = z.infer<typeof ForceLogoutResponseSchema>;
