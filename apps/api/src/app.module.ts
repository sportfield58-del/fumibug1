import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { EnvModule } from './config/env.module';
import { JwtGuard } from './common/guards/jwt.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { TransactionInterceptor } from './common/interceptors/transaction.interceptor';
import { RequestMiddleware } from './common/tenant/request.middleware';
import { TenantModule } from './common/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';

/**
 * Cableado global de seguridad — docs/spec/11-seguridad.md §K.2.
 *
 * El ORDEN de los providers es parte del contrato:
 *   RequestMiddleware (abre contexto + requestId)
 *     → JwtGuard (verifica token, publica user en el contexto)
 *       → TenantGuard (fija tenantId en el contexto)
 *         → TransactionInterceptor (SET LOCAL app.tenant_id + tx única del request)
 *           → handler
 *
 * Los módulos feature-based (customers, routes, field, ...) se agregan a partir de
 * Fase 1, uno por PR de contrato + implementación (ver docs/spec/16-estructura.md
 * §U y CLAUDE.md §6).
 */
@Module({
  imports: [EnvModule, TenantModule, AuthModule],
  controllers: [AppController],
  providers: [
    // Registro secuencial = orden de ejecución garantizado por Nest.
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: TransactionInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestMiddleware).forRoutes('*');
  }
}
