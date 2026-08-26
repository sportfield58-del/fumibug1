import { z } from 'zod';
import { PermissionKeySchema } from '../permissions';
import { TenantSchema } from './tenant';
import { UserSchema } from './user';

/**
 * docs/spec/10-api.md §J.2 (Auth) y docs/spec/11-seguridad.md §K.1.
 * `identifier` es el email (admin) o el username corto (operario, sin email real).
 * `password` es la contraseña de admin o el PIN de 6 dígitos del operario — mismo campo,
 * la política de validación difiere según el tipo de cuenta y se resuelve en el backend.
 */
export const LoginRequestSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(), // segundos
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const LoginResponseSchema = AuthTokensSchema.extend({
  user: UserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseSchema = AuthTokensSchema;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

/** POST /auth/pin — cambia el PIN propio del operario. */
export const ChangePinRequestSchema = z.object({
  currentPin: z.string().length(6),
  newPin: z.string().length(6),
});
export type ChangePinRequest = z.infer<typeof ChangePinRequestSchema>;

/** GET /auth/me — usuario, tenant, rol y permisos efectivos. */
export const MeResponseSchema = z.object({
  user: UserSchema,
  tenant: TenantSchema,
  roleKey: z.string(),
  permissions: z.array(PermissionKeySchema),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;
