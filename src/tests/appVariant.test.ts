import { describe, expect, test } from 'vitest';

import { shouldRenderSubLotteryApp } from '@/appVariant';

describe('app variant routing', () => {
  test('renders Sub Squad on the sub-lottery path', () => {
    expect(shouldRenderSubLotteryApp('/sub-lottery', undefined)).toBe(true);
    expect(shouldRenderSubLotteryApp('/sub-lottery/admin', undefined)).toBe(true);
  });

  test('keeps TeamBuilder on normal paths unless the subs variant is deployed', () => {
    expect(shouldRenderSubLotteryApp('/TeamBuilder', undefined)).toBe(false);
    expect(shouldRenderSubLotteryApp('/', undefined)).toBe(false);
    expect(shouldRenderSubLotteryApp('/', 'subs')).toBe(true);
  });
});
