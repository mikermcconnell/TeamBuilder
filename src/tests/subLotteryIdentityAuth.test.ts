import { beforeEach, describe, expect, test, vi } from 'vitest';

const records = new Map<string, Record<string, unknown>>();
const sendAccessCodeEmail = vi.fn();

vi.mock('@/server/sub-lottery/firebaseAdmin', () => ({
  getSubLotteryFirestore: vi.fn(async () => ({
    collection: (name: string) => ({ doc: (id: string) => {
      const key = `${name}/${id}`;
      return {
        get: async () => ({ exists: records.has(key), data: () => records.get(key) }),
        set: async (value: Record<string, unknown>) => { records.set(key, value); },
        update: async (value: Record<string, unknown>) => { records.set(key, { ...records.get(key), ...value }); },
        delete: async () => { records.delete(key); },
      };
    } }),
  })),
}));

vi.mock('@/server/sub-lottery/email', () => ({ sendAccessCodeEmail: (...args: unknown[]) => sendAccessCodeEmail(...args) }));

import { assertIdentitySession, hasIdentitySession, requestAccessCode, verifyAccessCode } from '@/server/sub-lottery/identityAuth';

describe('sub lottery email verification', () => {
  beforeEach(() => {
    records.clear();
    sendAccessCodeEmail.mockReset();
    sendAccessCodeEmail.mockResolvedValue(undefined);
    process.env.SUB_LOTTERY_CAPTAIN_PIN = 'captain-secret';
    process.env.SUB_LOTTERY_SESSION_SECRET = 'session-secret';
    records.set('subLotteryPlayers/player-1', { active: true, seasonId: 'live-season', email: 'player@example.com' });
    records.set('subLotteryPlayers/player-2', { active: true, seasonId: 'live-season', email: 'other@example.com' });
    records.set('subLotterySchedule/game-1', { active: true, seasonId: 'live-season', captainEmail: 'captain@example.com' });
  });

  test('a verified player session applies only to its own player', async () => {
    await requestAccessCode({ kind: 'player', subjectId: 'player-1' });
    expect(sendAccessCodeEmail).toHaveBeenCalledWith('player@example.com', expect.stringMatching(/^\d{6}$/));
    const code = sendAccessCodeEmail.mock.calls[0]![1] as string;
    await expect(verifyAccessCode({ kind: 'player', subjectId: 'player-1', code: 'xxxxxx' })).rejects.toThrow();
    const cookie = await verifyAccessCode({ kind: 'player', subjectId: 'player-1', code });
    const request = { headers: { cookie: cookie.split(';')[0] } };
    expect(hasIdentitySession(request, 'player', 'player-1')).toBe(true);
    expect(hasIdentitySession(request, 'player', 'player-2')).toBe(false);
    await expect(assertIdentitySession(request, 'player', 'player-2')).rejects.toThrow('Verify your email');
  });

  test('captain code requires the shared PIN and the session stays on one scheduled game', async () => {
    await expect(requestAccessCode({ kind: 'captain', subjectId: 'game-1', captainPin: 'wrong' })).rejects.toThrow('Invalid captain PIN');
    await requestAccessCode({ kind: 'captain', subjectId: 'game-1', captainPin: 'captain-secret' });
    const code = sendAccessCodeEmail.mock.calls[0]![1] as string;
    const cookie = await verifyAccessCode({ kind: 'captain', subjectId: 'game-1', code });
    const request = { headers: { cookie: cookie.split(';')[0] } };
    expect(hasIdentitySession(request, 'captain', 'game-1')).toBe(true);
    expect(hasIdentitySession(request, 'captain', 'game-2')).toBe(false);
  });
});
