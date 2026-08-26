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

  it('todo id de path es único y no arranca con /', () => {
    const paths = Object.values(ENDPOINTS).map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path.startsWith('/')).toBe(false);
    }
  });
});
