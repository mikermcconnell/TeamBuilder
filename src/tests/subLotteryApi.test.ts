import { afterEach, describe, expect, test, vi } from 'vitest';

import { cancelCaptainRequest } from '@/sub-lottery/api';

describe('sub lottery API client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('shows a friendly error when cancel request returns an empty response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));

    await expect(cancelCaptainRequest({ requestId: 'req-1', captainPin: 'captain' }))
      .rejects
      .toThrow('The server returned no response');
  });

  test('returns cancel request data from a normal JSON response', async () => {
    const data = {
      seasonId: 'season-1',
      seasonName: 'Season',
      players: [],
      requests: [],
      availability: [],
      scheduleEntries: [],
      assignments: [],
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, data }), { status: 200 })));

    await expect(cancelCaptainRequest({ requestId: 'req-1', captainPin: 'captain' }))
      .resolves
      .toEqual(data);
  });
});
