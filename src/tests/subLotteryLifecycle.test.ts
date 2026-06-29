import { describe, expect, test } from 'vitest';

import {
  createCaptainSubRequest,
  markSubAvailability,
  runSubLotteryDraw,
  runSubLotteryDrawCycle,
  cancelCaptainSubRequest,
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

  test('draws a weekly cycle by player entry order and limits each player to one win', () => {
    const requests: SubLotteryRequest[] = [
      createCaptainSubRequest({
        id: 'req-first-choice',
        seasonId: 'season-2026',
        captainName: 'Captain First',
        teamName: 'First Choice Team',
        gameLabel: 'Thursday 7:00 PM',
        pool: 'female',
        gameDate: '2026-06-24',
        now: new Date('2026-06-21T12:00:00.000Z'),
      }),
      createCaptainSubRequest({
        id: 'req-second-choice',
        seasonId: 'season-2026',
        captainName: 'Captain Second',
        teamName: 'Second Choice Team',
        gameLabel: 'Thursday 8:00 PM',
        pool: 'female',
        gameDate: '2026-06-24',
        now: new Date('2026-06-21T12:01:00.000Z'),
      }),
    ];

    const result = runSubLotteryDrawCycle({
      requests,
      players,
      availability: [
        { requestId: 'req-first-choice', playerId: 'alice', enteredAt: '2026-06-22T12:01:00.000Z' },
        { requestId: 'req-second-choice', playerId: 'alice', enteredAt: '2026-06-22T12:02:00.000Z' },
        { requestId: 'req-second-choice', playerId: 'bella', enteredAt: '2026-06-22T12:03:00.000Z' },
      ],
      now: new Date('2026-06-22T16:02:00.000Z'),
      random: () => 0,
    });

    expect(result.requests.find(request => request.id === 'req-first-choice')?.assignedPlayerIds).toEqual(['alice']);
    expect(result.requests.find(request => request.id === 'req-second-choice')?.assignedPlayerIds).toEqual(['bella']);
    expect(result.players.find(player => player.id === 'alice')?.seasonSubCount).toBe(1);
    expect(result.players.find(player => player.id === 'bella')?.seasonSubCount).toBe(3);
  });

  test('marks unfilled requests assigned with no winner after the draw', () => {
    const request = createCaptainSubRequest({
      id: 'req-empty',
      seasonId: 'season-2026',
      captainName: 'Captain Empty',
      teamName: 'Empty Team',
      gameLabel: 'Thursday 9:00 PM',
      pool: 'female',
      gameDate: '2026-06-24',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    const result = runSubLotteryDrawCycle({
      requests: [request],
      players,
      availability: [],
      now: new Date('2026-06-22T16:02:00.000Z'),
      random: () => 0,
    });

    expect(result.requests[0]).toMatchObject({
      id: 'req-empty',
      status: 'assigned',
      assignedPlayerIds: [],
    });
    expect(result.assignments).toEqual([]);
  });

  test('lets captains cancel open requests before the draw but not after', () => {
    const request = createCaptainSubRequest({
      id: 'req-cancel',
      seasonId: 'season-2026',
      captainName: 'Captain Cancel',
      teamName: 'Cancel Team',
      gameLabel: 'Thursday 9:00 PM',
      pool: 'female',
      gameDate: '2026-06-24',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(cancelCaptainSubRequest({
      request,
      now: new Date('2026-06-22T15:00:00.000Z'),
    })).toMatchObject({ status: 'void', cancelledAt: '2026-06-22T15:00:00.000Z' });

    expect(() => cancelCaptainSubRequest({
      request,
      now: new Date('2026-06-22T16:02:00.000Z'),
    })).toThrow('draw already completed');
  });


  test('excludes players who already won earlier in the same draw cycle', () => {
    const request = createCaptainSubRequest({
      id: 'req-later-choice',
      seasonId: 'season-2026',
      captainName: 'Captain Later',
      teamName: 'Later Choice Team',
      gameLabel: 'Thursday 8:00 PM',
      pool: 'female',
      gameDate: '2026-06-24',
      now: new Date('2026-06-21T12:01:00.000Z'),
    });

    const result = runSubLotteryDrawCycle({
      requests: [request],
      players,
      availability: [
        { requestId: 'req-later-choice', playerId: 'alice', enteredAt: '2026-06-22T12:01:00.000Z' },
        { requestId: 'req-later-choice', playerId: 'bella', enteredAt: '2026-06-22T12:02:00.000Z' },
      ],
      excludedPlayerIds: ['alice'],
      now: new Date('2026-06-22T16:02:00.000Z'),
      random: () => 0,
    });

    expect(result.requests[0]?.assignedPlayerIds).toEqual(['bella']);
  });

});
