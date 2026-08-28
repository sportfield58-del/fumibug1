import { randomInt } from 'node:crypto';

/**
 * Generación de PIN de operario — docs/spec/11-seguridad.md §K.1: PIN de 6 dígitos.
 * El PIN se entrega UNA sola vez (lo ve el admin al dar de alta / resetear) y el
 * operario lo cambia en su primer login (POST /auth/pin, contracts/schemas/auth.ts).
 *
 * No es criptográficamente sensible en tránsito hacia Supabase Auth (se lo manda como
 * password provisorio vía el client admin), pero se genera con CSPRNG y sin prefijo
 * repetible.
 */
export function generatePin(length = 6): string {
  // randomInt(0, 10) por dígito con el RNG criptográfico de Node: sin sesgo
  // perceptible y sin picos predecibles (Math.random no aplica acá).
  let pin = '';
  for (let i = 0; i < length; i++) pin += randomInt(0, 10).toString();
  return pin;
}
