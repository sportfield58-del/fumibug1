import { HttpException } from '@nestjs/common';
import type { ApiError, ApiSuccess, ErrorCode, ErrorDetail } from '@fumibug/contracts';
import { randomUUID } from 'node:crypto';
import { requestAls } from '../tenant/request-context';

/**
 * Envelope estándar de docs/spec/10-api.md §J.1 / packages/contracts/responses.ts.
 * Los helpers de acá garantizan que TODO error salga con la misma forma y con el
 * requestId del request en curso (para que el frontend reporte con trazabilidad).
 * El exception filter global de PR 7 reutilizará esta forma para errores no
 * controlados.
 */

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function httpApiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: ErrorDetail[],
): HttpException {
  const body: ApiError = {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    requestId: requestAls.getStore()?.requestId ?? randomUUID(),
  };
  return new HttpException(body, status);
}
