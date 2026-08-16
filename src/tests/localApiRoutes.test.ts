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

  test('bundles sub-lottery endpoints into one production function', () => {
    const apiDir = path.resolve(process.cwd(), 'api/sub-lottery');
    const routerText = readFileSync(path.resolve(process.cwd(), 'api/sub-lottery-router.ts'), 'utf8');
    const vercelConfig = JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      builds: Array<{ src: string }>;
      rewrites: Array<{ source: string; destination: string }>;
    };

    expect(vercelConfig.builds.map(build => build.src)).toContain('api/sub-lottery-router.ts');
    expect(vercelConfig.builds.map(build => build.src)).not.toContain('api/**/*.ts');
    expect(vercelConfig.rewrites).toContainEqual({
      source: '/api/sub-lottery/(.*)',
      destination: '/api/sub-lottery-router?route=$1',
    });

    readdirSync(apiDir)
      .filter(fileName => fileName.endsWith('.ts'))
      .forEach(fileName => {
        expect(routerText).toContain(`'./sub-lottery/${fileName.replace(/\.ts$/, '.js')}'`);
      });
  });
});
