import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * Setup de MSW para el navegador. NO es generado (a diferencia de handlers.ts) — es
 * boilerplate estable de MSW, OpenCode lo ajusta libremente si hace falta.
 *
 * Uso típico (en un componente cliente que arranca antes que el resto de la app, o en
 * instrumentation-client.ts de Next):
 *   if (process.env.NEXT_PUBLIC_API_MOCKING === 'true') {
 *     const { worker } = await import('@/mocks/browser');
 *     await worker.start({ onUnhandledRequest: 'bypass' });
 *   }
 */
export const worker = setupWorker(...handlers);
