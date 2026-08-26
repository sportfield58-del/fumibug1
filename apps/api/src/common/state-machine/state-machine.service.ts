import { Injectable } from '@nestjs/common';
import { Prisma } from '@fumibug/db';
import { httpApiError } from '../http/api-response';
import { TenantPrismaService } from '../tenant/tenant-prisma.service';
import { STATE_MACHINES, type EntityStatus, type StateMachineEntity } from './definitions';

export interface TransitionParams<E extends StateMachineEntity> {
  entity: E;
  id: string;
  from: EntityStatus<E>;
  to: EntityStatus<E>;
  actorId: string;
  reason?: string;
  /** Lanzan (cualquier excepción) para bloquear la transición. Corren ANTES del lock. */
  guards?: Array<() => void | Promise<void>>;
}

/**
 * docs/spec/04-estados.md §D.8: "Toda transición de estado se hace en el backend,
 * dentro de una transacción, con validación previa contra una tabla de transiciones
 * permitidas. Nunca `service.status = 'COMPLETED'` desde un controller."
 *
 * Resuelve el 90% de los problemas de concurrencia de un solo mecanismo (§I.R20): el
 * `SELECT ... FOR UPDATE` bloquea la fila hasta el commit de la transacción del
 * request (TransactionInterceptor), así que dos requests concurrentes sobre la misma
 * entidad se serializan acá — la segunda ve el estado ya cambiado y recibe
 * `STATE_CONFLICT` (409) en vez de pisar el resultado de la primera.
 *
 * Los nombres de tabla y de tipo ENUM vienen SIEMPRE de STATE_MACHINES (definitions.ts,
 * un registro fijo en este archivo, nunca de la request) — es lo único que hace seguro
 * usar `Prisma.raw()` para interpolar identificadores dentro de `Prisma.sql` (CLAUDE.md
 * §5: "$queryRaw solo con Prisma.sql template tags. Prohibido concatenar strings" — acá
 * no se concatena ningún valor de entrada, solo un literal de este módulo).
 */
@Injectable()
export class StateMachineService {
  constructor(private readonly db: TenantPrismaService) {}

  async transition<E extends StateMachineEntity>(params: TransitionParams<E>): Promise<void> {
    const config = STATE_MACHINES[params.entity];
    const allowed = (config.transitions as Record<string, readonly string[]>)[params.from];
    if (!allowed?.includes(params.to)) {
      throw httpApiError(
        'STATE_CONFLICT',
        `Transición ${params.from} → ${params.to} no permitida para "${params.entity}".`,
        409,
      );
    }

    for (const guard of params.guards ?? []) {
      await guard();
    }

    const tx = this.db.current();
    const table = Prisma.raw(`"${config.table}"`);
    const enumType = Prisma.raw(`"${config.statusEnumType}"`);

    const rows = await tx.$queryRaw<Array<{ status: string }>>(
      Prisma.sql`SELECT status FROM ${table} WHERE id = ${params.id}::uuid FOR UPDATE`,
    );
    if (rows.length === 0) {
      throw httpApiError('NOT_FOUND', `No se encontró "${params.entity}" con ese id.`, 404);
    }
    if (rows[0]?.status !== params.from) {
      throw httpApiError(
        'STATE_CONFLICT',
        `El estado actual de "${params.entity}" es ${rows[0]?.status}, se esperaba ${params.from}.`,
        409,
      );
    }

    const versionBump = config.hasVersion ? Prisma.sql`, version = version + 1` : Prisma.empty;
    await tx.$executeRaw(
      Prisma.sql`UPDATE ${table} SET status = ${params.to}::text::${enumType}, updated_at = now()${versionBump} WHERE id = ${params.id}::uuid`,
    );
  }
}
