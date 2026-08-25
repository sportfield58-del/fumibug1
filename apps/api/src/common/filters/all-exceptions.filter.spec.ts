import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import type { ApiError } from '@fumibug/contracts';
import { AllExceptionsFilter } from './all-exceptions.filter';
import type { StructuredLogger } from '../logging/structured-logger.service';
import { httpApiError } from '../http/api-response';

function host(res: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: <T>() => res as unknown as T,
      getRequest: <T>() => ({}) as unknown as T,
      getNext: () => undefined,
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getContext: () => undefined, getData: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined }),
    getType: () => 'http',
  } as unknown as ArgumentsHost;
}

function mockRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('AllExceptionsFilter', () => {
  let errorSpy: jest.Mock;
  let logger: StructuredLogger;
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    errorSpy = jest.fn();
    logger = { error: errorSpy } as unknown as StructuredLogger;
    filter = new AllExceptionsFilter(logger);
  });

  it('un ApiError ya armado (httpApiError) pasa tal cual, con su status', () => {
    const res = mockRes();
    const exception = httpApiError('FORBIDDEN', 'sin permiso', 403);
    filter.catch(exception, host(res));
    expect(res.status).toHaveBeenCalledWith(403);
    const call = res.json.mock.calls[0] as [ApiError];
    expect(call[0].success).toBe(false);
    expect(call[0].error.code).toBe('FORBIDDEN');
  });

  it('una excepción nativa de Nest se envuelve en el mismo formato de contrato', () => {
    const res = mockRes();
    filter.catch(new HttpException('no encontrado', HttpStatus.NOT_FOUND), host(res));
    expect(res.status).toHaveBeenCalledWith(404);
    const call = res.json.mock.calls[0] as [ApiError];
    const body = call[0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('no encontrado');
    expect(typeof body.requestId).toBe('string');
  });

  it('un error no controlado nunca filtra el mensaje real, siempre 500 INTERNAL_ERROR', () => {
    const res = mockRes();
    filter.catch(new Error('detalle interno sensible'), host(res));
    expect(res.status).toHaveBeenCalledWith(500);
    const call = res.json.mock.calls[0] as [ApiError];
    const body = call[0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('detalle interno sensible');
    expect(errorSpy).toHaveBeenCalled();
  });
});
