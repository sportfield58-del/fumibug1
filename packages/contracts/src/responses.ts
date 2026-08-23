import { z } from 'zod';
import { ErrorCodeSchema } from './errors';

/**
 * Formato de respuesta estándar — docs/spec/10-api.md §J.1 y CLAUDE.md §5.
 *
 * Éxito:  { success: true,  data, meta? }
 * Error:  { success: false, error: { code, message, details }, requestId }
 *
 * Los tipos genéricos (`ApiSuccess<T>`, `ApiError`, `Paginated<T>`) son la forma en la que
 * el resto del código (NestJS, cliente generado, MSW) tipa las respuestas. Las funciones
 * `apiSuccessSchema`/`paginatedSchema` son el equivalente en runtime para validar con Zod
 * cuando hace falta (ej. tests de contrato, MSW).
 */

// --- Detalle de error ---

export const ErrorDetailSchema = z.object({
  code: ErrorCodeSchema.optional(),
  field: z.string().optional(),
  message: z.string().optional(),
  value: z.unknown().optional(),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

// --- Paginación ---

export const PaginationMetaSchema = z.object({
  cursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
  total: z.number().int().nonnegative().optional(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// --- Error ---

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
  }),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// --- Éxito (genérico) ---

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export function apiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: PaginationMetaSchema.optional(),
  });
}

// --- Listas paginadas ---

export interface Paginated<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });
}

// --- Unión discriminada, para el cliente generado ---

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
