import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { RequestContextService } from './request-context.service';

/**
 * Abre el RequestContext (con requestId) antes de que corran los guards.
 *
 * Los guards de Nest corren DENTRO de la cadena async del middleware, así que el
 * store de AsyncLocalStorage creado acá los alcanza y ellos enriquecen el mismo
 * objeto (user → tenantId → tx). El requestId va en la respuesta para que el
 * frontend pueda reportar errores con trazabilidad (docs/spec/10-api.md §J.1).
 */
@Injectable()
export class RequestMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(_req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    this.context.run({ requestId }, next);
  }
}
