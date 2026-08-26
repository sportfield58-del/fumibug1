'use client';

import { useEffect, useState } from 'react';
import { configureApiClient, getPing } from '../../lib/api/client';
import type { ApiResponse } from '@fumibug/contracts';

// NEXT_PUBLIC_API_URL apunta a la API deployada (Railway) — se setea en PR 10. En local,
// sin la env var, cae en '/v1' relativo (sirve si hay un proxy de dev configurado).
configureApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/v1' });

/**
 * Esqueleto de Fase 0. Llama GET /v1/ping con el cliente generado — es el criterio de
 * salida de la Fase 0: "consumido desde el frontend deployado". Sin login todavía
 * (Fase 1, OpenCode), así que sin token esto devuelve 401 UNAUTHENTICATED — y ESO
 * también prueba el circuito completo: front deployado → API deployada → guards →
 * AllExceptionsFilter → el frontend recibe y muestra el envelope de error del
 * contrato, no un error de red genérico.
 */
export default function HomePage(): JSX.Element {
  const [result, setResult] = useState<ApiResponse<unknown> | { networkError: string } | null>(
    null,
  );

  useEffect(() => {
    getPing()
      .then(setResult)
      .catch((err: unknown) =>
        setResult({ networkError: err instanceof Error ? err.message : String(err) }),
      );
  }, []);

  return (
    <main>
      <h1>Fumibug</h1>
      <p>Esqueleto de Fase 0. Las pantallas de admin y campo las construye OpenCode.</p>
      <p>Respuesta de GET /v1/ping (esperable 401 sin login todavía — Fase 1):</p>
      <pre>{result ? JSON.stringify(result, null, 2) : 'cargando…'}</pre>
    </main>
  );
}
