import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const Schema = z.object({ name: z.string().min(1) }).strict();

  it('devuelve el valor parseado cuando es válido', () => {
    const pipe = new ZodValidationPipe(Schema);
    expect(pipe.transform({ name: 'Fumibug' })).toEqual({ name: 'Fumibug' });
  });

  it('rechaza con 400 VALIDATION_ERROR y el envelope del contrato', () => {
    const pipe = new ZodValidationPipe(Schema);
    try {
      pipe.transform({ name: '' });
      fail('debía rechazar');
    } catch (err) {
      const body = (err as { response?: { error?: { code?: string }; success?: boolean } }).response;
      expect(body?.success).toBe(false);
      expect(body?.error?.code).toBe('VALIDATION_ERROR');
    }
  });

  it('.strict() rechaza campos no declarados (equivalente a forbidNonWhitelisted)', () => {
    const pipe = new ZodValidationPipe(Schema);
    expect(() => pipe.transform({ name: 'x', extra: 'no debería estar' })).toThrow();
  });
});
