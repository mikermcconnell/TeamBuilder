import { describe, expect, test } from 'vitest';

import {
  calculateLotteryEntries,
  drawWeightedSubWinners,
  drawWeightedSubWinner,
  getEligibleAvailableSubs,
  parseSubPlayerCsv,
  parseSubScheduleCsv,
  getCurrentScheduleWeekLabel,
} from '@/sub-lottery/core';
import type { SubLotteryAvailability, SubLotteryPlayer } from '@/sub-lottery/types';
import { getSubLotteryCoins, getSubLotteryWorkflowState } from '@/sub-lottery/workflow';

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
      { playerId: 'alice', weight: 5 },
      { playerId: 'bella', weight: 3 },
    ]);
  });

  test('draws a deterministic weighted winner with an injected random value', () => {
    const winner = drawWeightedSubWinner([players[0]!, players[1]!], () => 0.9);

    expect(winner?.id).toBe('bella');
  });

  test('draws multiple unique weighted winners for a multi-slot request', () => {
    const winners = drawWeightedSubWinners([players[0]!, players[1]!], 2, () => 0);

    expect(winners.map(player => player.id)).toEqual(['alice', 'bella']);
  });

  test('calculates lottery coins with a floor of one', () => {
    expect(getSubLotteryCoins(0)).toBe(5);
    expect(getSubLotteryCoins(1)).toBe(4);
    expect(getSubLotteryCoins(4)).toBe(1);
    expect(getSubLotteryCoins(12)).toBe(1);
  });

  test('identifies weekly workflow phases in Toronto time', () => {
    expect(getSubLotteryWorkflowState(new Date('2026-06-21T16:00:00.000Z')).phase).toBe('captain');
    expect(getSubLotteryWorkflowState(new Date('2026-06-22T13:00:00.000Z')).phase).toBe('player');
    expect(getSubLotteryWorkflowState(new Date('2026-06-22T16:00:30.000Z')).phase).toBe('lottery');
    expect(getSubLotteryWorkflowState(new Date('2026-06-22T16:01:30.000Z')).phase).toBe('results');
  });

  test('parses an admin loaded sub list with open and female pools', () => {
    const parsed = parseSubPlayerCsv('Name,Pool\nAlice Green,Female\nOwen Orange,Open\n');

    expect(parsed).toEqual([
      { id: 'alice-green', name: 'Alice Green', pool: 'female', seasonSubCount: 0, active: true },
      { id: 'owen-orange', name: 'Owen Orange', pool: 'open', seasonSubCount: 0, active: true },
    ]);
  });

  test('parses optional player emails for winner notifications', () => {
    const parsed = parseSubPlayerCsv('Name,Email,Pool\nAlice Green,alice@example.com,Female\nOwen Orange,,Open\n');

    expect(parsed[0]).toMatchObject({
      id: 'alice-green',
      name: 'Alice Green',
      email: 'alice@example.com',
      pool: 'female',
    });
    expect(parsed[1]).not.toHaveProperty('email');
  });

  test('parses an uploaded weekly captain schedule with game dates', () => {
    const parsed = parseSubScheduleCsv('Week,Date,Captain,Team,Game Time,Pool\nWeek 1,2026-06-24,Morgan,Blue Team,Friday 8 PM,Female\nWeek 2,2026-07-01,Casey,Green Team,Friday 9 PM,Open\n');

    expect(parsed).toEqual([
      {
        id: 'week-1-2026-06-24-morgan-blue-team-friday-8-pm',
        weekLabel: 'Week 1',
        gameDate: '2026-06-24',
        captainName: 'Morgan',
        teamName: 'Blue Team',
        gameLabel: 'Friday 8 PM',
        pool: 'female',
        active: true,
      },
      {
        id: 'week-2-2026-07-01-casey-green-team-friday-9-pm',
        weekLabel: 'Week 2',
        gameDate: '2026-07-01',
        captainName: 'Casey',
        teamName: 'Green Team',
        gameLabel: 'Friday 9 PM',
        pool: 'open',
        active: true,
      },
    ]);
  });

  test('accepts mixed game schedules without a pool column', () => {
    const parsed = parseSubScheduleCsv('Week,Date,Captain,Team,Game Time\nWeek 1,2026-06-24,Morgan,Blue Team,Friday 8 PM\n');

    expect(parsed).toEqual([
      expect.objectContaining({
        captainName: 'Morgan',
        teamName: 'Blue Team',
        gameLabel: 'Friday 8 PM',
        pool: 'open',
      }),
    ]);
  });

  test('finds the current schedule week from game dates', () => {
    const schedule = parseSubScheduleCsv('Week,Date,Captain,Team,Game Time,Pool\nWeek 1,2026-06-24,Morgan,Blue Team,Friday 8 PM,Female\nWeek 2,2026-07-01,Casey,Green Team,Friday 9 PM,Open\n');

    expect(getCurrentScheduleWeekLabel(schedule, new Date('2026-06-25T12:00:00.000Z'))).toBe('Week 1');
    expect(getCurrentScheduleWeekLabel(schedule, new Date('2026-07-02T12:00:00.000Z'))).toBe('Week 2');
  });

  test('parses quoted CSV values and keeps duplicate player names distinct', () => {
    const parsedPlayers = parseSubPlayerCsv('Name,Pool\n"Alice, Green",Female\n"Alice, Green",Female\n');
    expect(parsedPlayers.map(player => player.id)).toEqual(['alice-green', 'alice-green-2']);

    const parsedSchedule = parseSubScheduleCsv('Week,Date,Captain,Team,Game Time,Pool\nWeek 1,2026-06-24,"Morgan, Jr.","Blue, Team",Friday 8 PM,Female\n');
    expect(parsedSchedule[0]).toMatchObject({
      captainName: 'Morgan, Jr.',
      teamName: 'Blue, Team',
    });
  });

});
