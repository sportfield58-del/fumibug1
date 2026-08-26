import { z } from 'zod';

/**
 * Catálogo de permisos — docs/spec/02-roles.md §B.2. Formato `recurso.acción`.
 * "El código nunca pregunta `if (user.role === 'ADMIN')`. Pregunta `if (can(user,
 * 'route.publish'))`." Se usa en `@RequirePermission()` (PR 6) y en la validación de
 * `role_permissions` en el admin de usuarios/roles (Fase 1+).
 */
export const PERMISSION_KEY = [
  // Clientes y ubicaciones
  'customer.read',
  'customer.create',
  'customer.update',
  'customer.archive',
  'location.read',
  'location.create',
  'location.update',
  'location.archive',

  // Contratos y servicios
  'contract.read',
  'contract.create',
  'contract.update',
  'contract.cancel',
  'service.read.own',
  'service.read.tenant',
  'service.create',
  'service.update',
  'service.cancel',
  'service.reschedule',
  'service.price.override',

  // Rutas
  'route.read.own',
  'route.read.tenant',
  'route.create',
  'route.update',
  'route.publish',
  'route.unpublish',
  'route.cancel',

  // Ejecución
  'session.start',
  'session.finish',
  'session.reopen',
  'evidence.upload',
  'evidence.delete',
  'stop.mark_no_show',
  'stop.skip',

  // Cierre y validación
  'service.close',
  'service.validate',
  'service.reject',

  // Certificados
  'certificate.read',
  'certificate.issue',
  'certificate.sign',
  'certificate.void',

  // Insumos e inventario
  'supply.read',
  'supply.create',
  'supply.update',
  'inventory.read.own',
  'inventory.read.tenant',
  'inventory.transfer',
  'inventory.adjust',
  'inventory.allow_negative',

  // Dinero
  'payment.read.own',
  'payment.read.tenant',
  'payment.create',
  'payment.void',
  'cash.read.own',
  'cash.read.tenant',
  'cash.close.own',
  'cash.approve_closure',
  'cash.adjust',

  // Administración
  'user.read',
  'user.create',
  'user.update',
  'user.deactivate',
  'role.manage',
  'settings.manage',
  'audit.read',
  'report.operational',
  'report.financial',
] as const;

export const PermissionKeySchema = z.enum(PERMISSION_KEY);
export type PermissionKey = z.infer<typeof PermissionKeySchema>;

/**
 * docs/spec/02-roles.md §B.1: "cada permiso admite un scope opcional (own | team | tenant)".
 * `own` lo aplica el servidor filtrando por el actor — nunca el frontend (§K.2).
 */
export const PERMISSION_SCOPE = ['own', 'team', 'tenant'] as const;
export const PermissionScopeSchema = z.enum(PERMISSION_SCOPE);
export type PermissionScope = z.infer<typeof PermissionScopeSchema>;

/** Roles semilla — docs/spec/08-modelo-datos.md §H.2 (`roles`). No es un ENUM de Postgres:
 * cada tenant tiene sus propios roles (H.4.5), esto es solo el set con el que se siembra. */
export const SEED_ROLE_KEY = [
  'owner',
  'admin',
  'supervisor',
  'office',
  'technician',
  'technical_director',
] as const;
export const SeedRoleKeySchema = z.enum(SEED_ROLE_KEY);
export type SeedRoleKey = z.infer<typeof SeedRoleKeySchema>;
