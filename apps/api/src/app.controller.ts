import { Controller, Get } from '@nestjs/common';

/**
 * Health check sin autenticar, para probes de Railway y smoke tests.
 * No confundir con GET /v1/ping (PR 7): ese sí requiere JWT + tenant + permiso
 * y queda auditado — es el criterio de salida de la Fase 0.
 */
@Controller()
export class AppController {
  @Get('health')
  health(): { status: 'ok'; service: 'fumibug-api' } {
    return { status: 'ok', service: 'fumibug-api' };
  }
}
