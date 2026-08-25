import { type PipeTransform, Injectable } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';
import { httpApiError } from '../http/api-response';

/**
 * Validación con Zod — CLAUDE.md §5: "Validación con Zod desde packages/contracts.
 * ValidationPipe global con whitelist: true y forbidNonWhitelisted: true".
 *
 * El `ValidationPipe` que trae Nest es de `class-validator`, no de Zod, así que acá no
 * hay un pipe global único: cada endpoint aplica `new ZodValidationPipe(Schema)` sobre
 * el parámetro que corresponda (`@Body()`, `@Query()`). `z.object(...).strict()` es lo
 * que da el equivalente de whitelist+forbidNonWhitelisted — un campo no declarado en el
 * schema rechaza la request en vez de colarse al ORM. Los schemas de cada módulo salen
 * siempre de `@fumibug/contracts` (ADR 0005): este pipe nunca valida contra un schema
 * definido localmente en un controller.
 *
 * Sin DTOs de negocio todavía (Fase 0 no tiene endpoints de negocio) — el primer
 * consumidor real llega con el primer módulo de Fase 1.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw httpApiError(
        'VALIDATION_ERROR',
        'La request no cumple el schema esperado.',
        400,
        result.error.issues.map((issue) => ({
          field: issue.path.join('.') || undefined,
          message: issue.message,
        })),
      );
    }
    return result.data;
  }
}
