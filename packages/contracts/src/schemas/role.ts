import { z } from 'zod';
import { PermissionKeySchema, PermissionScopeSchema } from '../permissions';

/**
 * docs/spec/08-modelo-datos.md §H.2 `roles`. No hay tabla de roles global: cada tenant
 * tiene los suyos (ADR — evita un retrofit doloroso en Fase 3), aunque en Fase 1 solo
 * existen los 6 roles semilla (`SEED_ROLE_KEY` en ../permissions) — no hay UI de alta de
 * rol custom todavía.
 */
export const RoleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  isSystem: z.boolean(),
  description: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Role = z.infer<typeof RoleSchema>;

/** docs/spec/08-modelo-datos.md §H.2 `role_permissions`. */
export const RolePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionKey: PermissionKeySchema,
  scope: PermissionScopeSchema,
});
export type RolePermission = z.infer<typeof RolePermissionSchema>;

/** GET /roles — cada rol con su matriz de permisos resuelta, para la pantalla de gestión. */
export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(RolePermissionSchema),
});
export type RoleWithPermissions = z.infer<typeof RoleWithPermissionsSchema>;
