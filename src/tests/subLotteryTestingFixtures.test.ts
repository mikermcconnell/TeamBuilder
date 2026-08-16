import { describe, expect, test } from 'vitest';

import { getPersistedSubLotteryTestingFixture, getSubLotteryTestingFixture } from '@/sub-lottery/testingFixtures';

describe('sub lottery testing fixtures', () => {
  test('provides complete, isolated data for every testing phase', () => {
    for (const phase of ['captain', 'player', 'results'] as const) {
      const fixture = getSubLotteryTestingFixture(phase, new Date('2026-08-07T12:00:00-04:00'));

      expect(fixture.state.players).toHaveLength(20);
      expect(fixture.state.scheduleEntries).toHaveLength(5);
      expect(fixture.state.requests).toHaveLength(5);
      expect(new Set(fixture.state.requests.map(request => request.captainName)).size).toBe(5);
      expect(fixture.state.availability).toHaveLength(phase === 'results' ? 25 : 0);
    }
  });

  test('never selects the same testing player for two games in the results phase', () => {
    const { state } = getSubLotteryTestingFixture('results', new Date('2026-08-07T12:00:00-04:00'));
    const winnerIds = state.assignments.map(assignment => assignment.playerId);

    expect(winnerIds.length).toBeGreaterThan(0);
    expect(new Set(winnerIds).size).toBe(winnerIds.length);
    expect(state.requests.every(request => request.status === 'assigned')).toBe(true);
  });

  test('namespaces each saved Firebase testing week', () => {
    const { state, weekStartDate } = getPersistedSubLotteryTestingFixture('player', new Date('2026-08-07T12:00:00-04:00'));

    expect(state.seasonId).toBe(`testing-${weekStartDate}`);
    expect(state.players.every(player => player.id.startsWith(`${state.seasonId}-`))).toBe(true);
    expect(state.scheduleEntries.every(entry => entry.id.startsWith(`${state.seasonId}-`))).toBe(true);
    expect(state.requests.every(request => request.id.startsWith(`${state.seasonId}-`))).toBe(true);
    expect(state.players.every(player => !player.email)).toBe(true);
  });
});
