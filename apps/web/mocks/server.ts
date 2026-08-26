import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * Setup de MSW para tests (Node, sin navegador). NO es generado — boilerplate estable.
 * Uso típico en la config de tests: server.listen()/resetHandlers()/close() en los
 * hooks de beforeAll/afterEach/afterAll.
 */
export const server = setupServer(...handlers);
