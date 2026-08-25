import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError, ErrorCode } from '@fumibug/contracts';
import { requestAls } from '../tenant/request-context';
import { StructuredLogger } from '../logging/structured-logger.service';
import { captureException } from '../observability/sentry';

/**
 * Filtro global — docs/spec/10-api.md §J.1: TODA respuesta de error tiene esta forma,
 * la produzca el código explícitamente (`httpApiError`, ver `../http/api-response.ts`)
 * o sea una excepción no controlada. El frontend nunca parsea `message`, solo `error.code`.
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = requestAls.getStore()?.requestId ?? 'no-request-id';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (isApiErrorBody(payload)) {
        // Ya viene armado por httpApiError() — el caso común en guards y servicios.
        res.status(status).json(payload);
        return;
      }

      // Excepción "nativa" de Nest (ValidationPipe por defecto, NotFoundException de
      // un middleware de terceros, etc.) — se envuelve para que el frontend nunca vea
      // dos formas de error distintas.
      res.status(status).json(wrapNestException(status, payload, requestId));
      return;
    }

    // Error no controlado: nunca se filtra el mensaje real al cliente (podría filtrar
    // detalles internos), pero se loguea completo con el requestId para correlacionar,
    // y se reporta a Sentry (no-op si no hay SENTRY_DSN — ver observability/sentry.ts).
    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      undefined,
      'AllExceptionsFilter',
    );
    captureException(exception);

    const body: ApiError = {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Error interno. Reportar con el requestId.' },
      requestId,
    };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}

function isApiErrorBody(payload: unknown): payload is ApiError {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { success?: unknown }).success === false &&
    typeof (payload as { requestId?: unknown }).requestId === 'string'
  );
}

function wrapNestException(status: number, payload: unknown, requestId: string): ApiError {
  const rawMessage = (payload as { message?: unknown } | undefined)?.message;
  const message =
    typeof payload === 'string'
      ? payload
      : typeof rawMessage === 'string'
        ? rawMessage
        : Array.isArray(rawMessage)
          ? rawMessage.join('; ')
          : 'Error de validación.';
  return { success: false, error: { code: statusToErrorCode(status), message }, requestId };
}

function statusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'VERSION_CONFLICT';
    case 422:
      return 'BUSINESS_RULE_VIOLATION';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}
