import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { EnvModule } from './config/env.module';
import { JwtGuard } from './common/guards/jwt.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { TransactionInterceptor } from './common/interceptors/transaction.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestMiddleware } from './common/tenant/request.middleware';
import { TenantModule } from './common/tenant/tenant.module';
import { AuditModule } from './common/audit/audit.module';
import { StateMachineModule } from './common/state-machine/state-machine.module';
import { LoggingModule } from './common/logging/logging.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ServiceCatalogModule } from './modules/service-catalog/service-catalog.module';
import { ServicesModule } from './modules/services/services.module';
import { RoutesModule } from './modules/routes/routes.module';

/**
 * Cableado global de seguridad — docs/spec/11-seguridad.md §K.2.
 *
 * El ORDEN de los providers es parte del contrato:
 *   RequestMiddleware (abre contexto + requestId, IP, user-agent)
 *     → JwtGuard (verifica token, publica user en el contexto)
 *       → RateLimitGuard (§K.6 — necesita saber si hay user para elegir el límite)
 *         → TenantGuard (fija tenantId en el contexto)
 *           → PermissionGuard (exige @RequirePermission si el handler lo declara)
 *             → TransactionInterceptor (SET LOCAL app.tenant_id + tx única del request)
 *               → handler
 *   AllExceptionsFilter envuelve todo — corre al final, sea cual sea el punto donde
 *   algo lance (guard, interceptor o handler).
 *
 * Los módulos feature-based (customers, routes, field, ...) se agregan a partir de
 * Fase 1, uno por PR de contrato + implementación (ver docs/spec/16-estructura.md
 * §U y CLAUDE.md §6).
 */
@Module({
  imports: [
    EnvModule,
    LoggingModule,
    TenantModule,
    AuditModule,
    StateMachineModule,
    AuthModule,
    DashboardModule,
    UsersModule,
    CustomersModule,
    ServiceCatalogModule,
    ServicesModule,
    RoutesModule,
  ],
  controllers: [AppController],
  providers: [
    // Registro secuencial = orden de ejecución garantizado por Nest.
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_INTERCEPTOR, useClass: TransactionInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestMiddleware).forRoutes('*');
  }
}
