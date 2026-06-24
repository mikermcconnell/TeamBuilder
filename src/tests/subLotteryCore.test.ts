import { describe, expect, test } from 'vitest';

import {
  calculateLotteryEntries,
  drawWeightedSubWinner,
  getEligibleAvailableSubs,
  parseSubPlayerCsv,
} from '@/sub-lottery/core';
import type { SubLotteryAvailability, SubLotteryPlayer } from '@/sub-lottery/types';

const players: SubLotteryPlayer[] = [
  { id: 'alice', name: 'Alice Green', pool: 'female', seasonSubCount: 0, active: true },
  { id: 'bella', name: 'Bella Blue', pool: 'female', seasonSubCount: 2, active: true },
  { id: 'owen', name: 'Owen Orange', pool: 'open', seasonSubCount: 0, active: true },
  { id: 'inactive', name: 'Ivy Inactive', pool: 'female', seasonSubCount: 0, active: false },
];

const availability: SubLotteryAvailability[] = [
  { requestId: 'req-1', playerId: 'alice', enteredAt: '2026-06-24T12:00:00.000Z' },
  { requestId: 'req-1', playerId: 'bella', enteredAt: '2026-06-24T12:02:00.000Z' },
  { requestId: 'req-1', playerId: 'owen', enteredAt: '2026-06-24T12:03:00.000Z' },
  { requestId: 'req-1', playerId: 'inactive', enteredAt: '2026-06-24T12:04:00.000Z' },
];

describe('sub lottery core', () => {
  test('filters available subs by matching pool and active roster status', () => {
    const eligible = getEligibleAvailableSubs({
      requestId: 'req-1',
      pool: 'female',
      players,
      availability,
    });

    expect(eligible.map(player => player.id)).toEqual(['alice', 'bella']);
  });

  test('weights players by current season sub count', () => {
    const entries = calculateLotteryEntries([players[0]!, players[1]!]);

    expect(entries).toEqual([
      { playerId: 'alice', weight: 1 },
      { playerId: 'bella', weight: 1 / 3 },
    ]);
  });

  test('draws a deterministic weighted winner with an injected random value', () => {
    const winner = drawWeightedSubWinner([players[0]!, players[1]!], () => 0.9);

    expect(winner?.id).toBe('bella');
  });

  test('parses an admin loaded sub list with open and female pools', () => {
    const parsed = parseSubPlayerCsv('Name,Pool\nAlice Green,Female\nOwen Orange,Open\n');

    expect(parsed).toEqual([
      { id: 'alice-green', name: 'Alice Green', pool: 'female', seasonSubCount: 0, active: true },
      { id: 'owen-orange', name: 'Owen Orange', pool: 'open', seasonSubCount: 0, active: true },
    ]);
  });
});
