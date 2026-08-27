import { ENDPOINTS } from './endpoints';

describe('ENDPOINTS', () => {
  it('el example de cada endpoint valida contra su propio response schema', () => {
    for (const [id, def] of Object.entries(ENDPOINTS)) {
      const result = def.response.safeParse(def.example);
      if (!result.success) {
        throw new Error(`Endpoint "${id}": el example no valida — ${result.error.message}`);
      }
    }
  });

  it('todo par (method, path) es único y ningún path arranca con /', () => {
    const defs = Object.values(ENDPOINTS);
    const pairs = defs.map((e) => `${e.method} ${e.path}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const def of defs) {
      expect(def.path.startsWith('/')).toBe(false);
    }
  });
});
