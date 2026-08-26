import { Controller, Get } from '@nestjs/common';
import { Public } from './common/guards/public.decorator';

/**
 * Health check sin autenticar, para probes de Railway y smoke tests.
 * No confundir con GET /v1/auth/me (PR 5): ese requiere JWT + tenant y es la
 * prueba end-to-end de guards + tenant context + extensión de Prisma.
 */
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health(): { status: 'ok'; service: 'fumibug-api' } {
    return { status: 'ok', service: 'fumibug-api' };
  }
}
