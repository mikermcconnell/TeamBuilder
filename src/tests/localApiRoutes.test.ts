import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('local API dev routes', () => {
  test('serves every sub-lottery serverless route in Vite dev', () => {
    const apiDir = path.resolve(process.cwd(), 'api/sub-lottery');
    const viteConfigText = readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    readdirSync(apiDir)
      .filter(fileName => fileName.endsWith('.ts'))
      .forEach(fileName => {
        const route = `/api/sub-lottery/${fileName.replace(/\.ts$/, '')}`;
        const modulePath = `/api/sub-lottery/${fileName}`;
        expect(viteConfigText).toContain(`'${route}'`);
        expect(viteConfigText).toContain(`'${modulePath}'`);
      });
  });
});
