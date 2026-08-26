import { Global, Module } from '@nestjs/common';
import { parseEnv, type Env } from './env';

/**
 * Token de inyección para la config validada. Un único proveedor global evita que
 * cada módulo re-parse process.env y garantiza que el boot falle rápido si falta
 * algo (docs/spec/11-seguridad.md §K.8).
 */
export const ENV = Symbol('FUMIBUG_ENV');

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => parseEnv(process.env) }],
  exports: [ENV],
})
export class EnvModule {}

export type { Env };
