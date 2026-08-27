import { z } from 'zod';
import { LicenseTypeSchema } from '../enums';

/** docs/spec/08-modelo-datos.md §H.2 `vehicles`. */
export const VehicleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  plate: z.string().max(20).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

/**
 * docs/spec/08-modelo-datos.md §H.2 `technician_profiles` — extensión de User para
 * operarios y Director Técnico. `licenseType` distingue cuál de las dos matrículas es:
 * `SANITARY_BOOK` (libreta sanitaria del operario, docs/spec/03-modulos.md §C.2 — alerta
 * automática a 30 días de vencer, R15) o `TECHNICAL_DIRECTOR` (matrícula del DT que firma
 * certificados, §C.21).
 *
 * NOTA (gap de spec vs schema, para no perderlo): §C.2 también pide "licencia de
 * conducir" como dato separado de la libreta sanitaria — hoy el modelo no tiene un campo
 * propio para eso. Fast-follow: agregar `driverLicenseNumber`/`driverLicenseExpiresAt` a
 * `TechnicianProfile` en una migración aparte antes de que el flujo de alta de operario
 * lo necesite (ver prompts/TASK_BOARD.md).
 */
export const TechnicianProfileSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  licenseNumber: z.string().max(60).nullable().optional(),
  licenseType: LicenseTypeSchema,
  licenseExpiresAt: z.string().date().nullable().optional(),
  signatureUrl: z.string().url().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  stockLocationId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TechnicianProfile = z.infer<typeof TechnicianProfileSchema>;
