import {
  Injectable,
  InternalServerErrorException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaClient } from '@fumibug/db';
import { ENV, type Env } from '../../config/env.module';
import { RequestContextService } from './request-context.service';
import { withTenantScope, type RequestTx, type TenantDbClient } from './prisma-tenant.extension';

/**
 * Dueño del PrismaClient de runtime. Se conecta con APP_DATABASE_URL (rol
 * `fumibug_app`, SIN BYPASSRLS) — sin esto la RLS sería teatro (§K.3).
 *
 * Modelo de transacción: UNA transacción por request, abierta por
 * TransactionInterceptor. Dentro se ejecuta `SET LOCAL app.tenant_id` (Capa 2, §K.4)
 * y todos los servicios operan sobre ese mismo tx vía current(). Beneficios:
 * - atomicidad por request (o queda todo o no queda nada);
 * - auditoría en la misma transacción que la mutación (§K.10), requisito de PR 7;
 * - el GUC vive solo en esa transacción: cero riesgo de fuga entre conexiones.
 */
@Injectable()
export class TenantPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly base: PrismaClient;
  private readonly client: TenantDbClient;

  constructor(
    @Inject(ENV) env: Env,
    private readonly context: RequestContextService,
  ) {
    this.base = new PrismaClient({ datasourceUrl: env.APP_DATABASE_URL });
    this.client = withTenantScope(this.base);
  }

  async onModuleInit(): Promise<void> {
    await this.base.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }

  /**
   * Abre LA transacción del request: setea `app.tenant_id` (visible solo dentro de
   * esta transacción) y publica el tx en el contexto para current().
   * Si `fn` lanza, la transacción hace rollback y el error sube al filtro global.
   */
  async runInRequestTransaction<T>(fn: (tx: RequestTx) => Promise<T>): Promise<T> {
    const store = this.context.get();
    const tenantId = store.tenantId;
    if (!tenantId) {
      throw new InternalServerErrorException(
        'runInRequestTransaction sin tenantId: TenantGuard no corrió antes del ' +
          'interceptor (revisar orden de providers en AppModule).',
      );
    }

    return this.client.$transaction(
      async (tx) => {
        // set_config(..., true) = scope de transacción. Parametrizado por Prisma,
        // nunca concatenado (§K.5).
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        store.tx = tx as RequestTx;
        try {
          return await fn(store.tx);
        } finally {
          delete store.tx;
        }
      },
      // timeout: default de Prisma es 5000ms — algunos handlers (ej. publicar una
      // ruta, R12: atómico) encadenan varias transiciones de StateMachineService,
      // cada una con su propio SELECT ... FOR UPDATE, dentro de esta misma
      // transacción. Contra el connection pooler de Supabase (más latencia que una
      // conexión directa) eso alcanzó a superar los 5s reales — encontrado
      // probando publish() de punta a punta en producción, no una precaución
      // teórica. 15s da margen sin volver indefinido el bloqueo de filas.
      { timeout: 15_000 },
    );
  }

  /** Cliente transaccional del request en curso, ya con tenant scoping garantizado. */
  current(): RequestTx {
    const tx = this.context.get().tx;
    if (!tx) {
      throw new InternalServerErrorException(
        'Operación fuera de la transacción del request. Los servicios deben usar ' +
          'TenantPrismaService.current() dentro del flujo del request.',
      );
    }
    return tx;
  }

  /**
   * Cliente base SIN scoping de tenant, para rutas públicas (@Public, sin JWT) donde no
   * hay request transaction. SOLO para lecturas by-token de datos expresamente públicos
   * (ej. verificación de un certificado por verificationToken). Nunca para mutar ni para
   * resolver en contextos autenticados.
   */
  baseClient(): PrismaClient {
    return this.base;
  }
}
