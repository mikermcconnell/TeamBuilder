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
  test('creates a captain request with a fixed two hour entry window', () => {
    const request = createCaptainSubRequest({
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      now: new Date('2026-06-24T12:00:00.000Z'),
    });

    expect(request).toMatchObject({
      id: 'req-1',
      status: 'open',
      openedAt: '2026-06-24T12:00:00.000Z',
      closesAt: '2026-06-24T14:00:00.000Z',
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

  test('does not draw before the request window closes', () => {
    const request: SubLotteryRequest = createCaptainSubRequest({
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      now: new Date('2026-06-24T12:00:00.000Z'),
    });

    const result = runSubLotteryDraw({
      request,
      players,
      availability: [
        { requestId: 'req-1', playerId: 'alice', enteredAt: '2026-06-24T12:01:00.000Z' },
      ],
      now: new Date('2026-06-24T13:59:00.000Z'),
      random: () => 0,
    });

    expect(result.status).toBe('not-ready');
  });

  test('assigns one eligible winner after close and increments their season count', () => {
    const request: SubLotteryRequest = createCaptainSubRequest({
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      now: new Date('2026-06-24T12:00:00.000Z'),
    });

    const result = runSubLotteryDraw({
      request,
      players,
      availability: [
        { requestId: 'req-1', playerId: 'alice', enteredAt: '2026-06-24T12:01:00.000Z' },
        { requestId: 'req-1', playerId: 'bella', enteredAt: '2026-06-24T12:02:00.000Z' },
      ],
      now: new Date('2026-06-24T14:01:00.000Z'),
      random: () => 0,
    });

    expect(result.status).toBe('assigned');
    if (result.status !== 'assigned') throw new Error('expected assignment');
    expect(result.request.assignedPlayerId).toBe('alice');
    expect(result.players.find(player => player.id === 'alice')?.seasonSubCount).toBe(1);
  });
});
