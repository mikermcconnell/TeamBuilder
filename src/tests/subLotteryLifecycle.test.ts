import { describe, expect, test } from 'vitest';

import {
  createCaptainSubRequest,
  markSubAvailability,
  runSubLotteryDraw,
} from '@/sub-lottery/lifecycle';
import type {
  SubLotteryAvailability,
  SubLotteryPlayer,
  SubLotteryRequest,
} from '@/sub-lottery/types';

const players: SubLotteryPlayer[] = [
  { id: 'alice', name: 'Alice Green', pool: 'female', seasonSubCount: 0, active: true },
  { id: 'bella', name: 'Bella Blue', pool: 'female', seasonSubCount: 2, active: true },
];

describe('sub lottery lifecycle', () => {
  test('creates a captain request with the weekly player entry and draw windows', () => {
    const request = createCaptainSubRequest({
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      gameDate: '2026-06-24',
      slotsNeeded: 2,
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(request).toMatchObject({
      id: 'req-1',
      status: 'open',
      openedAt: '2026-06-21T12:00:00.000Z',
      slotsNeeded: 2,
      availabilityOpensAt: '2026-06-22T04:00:00.000Z',
      availabilityClosesAt: '2026-06-22T15:59:59.000Z',
      drawAt: '2026-06-22T16:01:00.000Z',
    });
  });

  test('marks one availability entry per request and player', () => {
    const existing: SubLotteryAvailability[] = [
      { requestId: 'req-1', playerId: 'alice', enteredAt: '2026-06-24T12:01:00.000Z' },
    ];

    const updated = markSubAvailability({
      existing,
      requestId: 'req-1',
      playerId: 'alice',
      now: new Date('2026-06-24T12:05:00.000Z'),
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]?.enteredAt).toBe('2026-06-24T12:01:00.000Z');
  });

  test('blocks player availability outside the Monday entry window', () => {
    const request: SubLotteryRequest = createCaptainSubRequest({
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      gameDate: '2026-06-24',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(() => markSubAvailability({
      existing: [],
      requestId: 'req-1',
      playerId: 'alice',
      request,
      now: new Date('2026-06-22T03:59:00.000Z'),
    })).toThrow('not open');

    expect(() => markSubAvailability({
      existing: [],
      requestId: 'req-1',
      playerId: 'alice',
      request,
      now: new Date('2026-06-22T16:00:00.000Z'),
    })).toThrow('closed');
  });

  test('does not draw before the request window closes', () => {
    const request: SubLotteryRequest = createCaptainSubRequest({
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      gameDate: '2026-06-24',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    const result = runSubLotteryDraw({
      request,
      players,
      availability: [
        { requestId: 'req-1', playerId: 'alice', enteredAt: '2026-06-24T12:01:00.000Z' },
      ],
      now: new Date('2026-06-22T16:00:00.000Z'),
      random: () => 0,
    });

    expect(result.status).toBe('not-ready');
  });

  test('assigns multiple eligible winners after draw time and records assignments', () => {
    const request: SubLotteryRequest = createCaptainSubRequest({
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      slotsNeeded: 2,
      gameDate: '2026-06-24',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    const result = runSubLotteryDraw({
      request,
      players,
      availability: [
        { requestId: 'req-1', playerId: 'alice', enteredAt: '2026-06-24T12:01:00.000Z' },
        { requestId: 'req-1', playerId: 'bella', enteredAt: '2026-06-24T12:02:00.000Z' },
      ],
      now: new Date('2026-06-22T16:02:00.000Z'),
      random: () => 0,
    });

    expect(result.status).toBe('assigned');
    if (result.status !== 'assigned') throw new Error('expected assignment');
    expect(result.request.assignedPlayerIds).toEqual(['alice', 'bella']);
    expect(result.players.find(player => player.id === 'alice')?.seasonSubCount).toBe(1);
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments[0]).toMatchObject({
      requestId: 'req-1',
      playerId: 'alice',
      teamName: 'Green Team',
      eligiblePlayerIds: ['alice', 'bella'],
    });
  });
});
