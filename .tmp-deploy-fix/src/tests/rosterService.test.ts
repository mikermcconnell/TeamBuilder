import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(() => ({ kind: 'collection' })),
  deleteDoc: vi.fn(),
  doc: vi.fn((...args: unknown[]) => {
    const [, collectionName, id] = args as [unknown, string, string];
    return { kind: 'doc', path: `${collectionName}/${id}` };
  }),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value: number) => ({ kind: 'limit', value })),
  orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
  query: vi.fn((...args: unknown[]) => ({ kind: 'query', args })),
  Timestamp: {
    now: vi.fn(() => ({ kind: 'timestamp' })),
  },
  updateDoc: vi.fn(),
  where: vi.fn((field: string, op: string, value: unknown) => ({ kind: 'where', field, op, value })),
}));

const authMock = vi.hoisted(() => ({
  currentUser: { uid: 'owner-1' },
  onAuthStateChanged: vi.fn((callback: (user: unknown) => void) => {
    callback(authMock.currentUser);
    return () => undefined;
  }),
}));

vi.mock('@/config/firebase', () => ({
  auth: authMock,
  db: { kind: 'db' },
}));

vi.mock('firebase/firestore', () => firestoreMocks);

import { getUserRosters, saveRoster } from '@/services/rosterService';
import type { LeagueConfig, Player, PlayerGroup, Team } from '@/types';

function createPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'gender'>): Player {
  return {
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

function createRosterPlayerGroup(overrides: Partial<PlayerGroup> & Pick<PlayerGroup, 'id' | 'label' | 'color' | 'playerIds' | 'players'>): PlayerGroup {
  return {
    ...overrides,
  };
}

describe('rosterService', () => {
  const config: LeagueConfig = {
    id: 'league-1',
    name: 'League',
    maxTeamSize: 7,
    minFemales: 1,
    minMales: 1,
    allowMixedGender: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.currentUser = { uid: 'owner-1' };
    authMock.onAuthStateChanged.mockImplementation((callback: (user: unknown) => void) => {
      callback(authMock.currentUser);
      return () => undefined;
    });

    firestoreMocks.addDoc.mockResolvedValue({ id: 'roster-123' });
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] });
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
  });

  it('saves a roster for the authenticated owner and strips undefined values from payloads', async () => {
    const team: Team = {
      id: 'team-1',
      name: 'Team 1',
      players: [
        createPlayer({
          id: 'p1',
          name: 'Alex Example',
          gender: 'M',
          skillRating: 7,
          execSkillRating: 8,
          email: undefined,
        }),
      ],
      averageSkill: 7,
      genderBreakdown: { M: 1, F: 0, Other: 0 },
    };

    const rosterId = await saveRoster({
      userId: 'owner-1',
      name: 'Spring Roster',
      description: undefined,
      players: team.players,
      playerGroups: [
        createRosterPlayerGroup({
          id: 'group-a',
          label: 'A',
          color: '#3B82F6',
          playerIds: ['p1'],
          players: team.players,
        }),
      ],
      teams: [team],
      unassignedPlayers: [],
      config,
      version: 1,
    });

    expect(rosterId).toBe('roster-123');
    expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1);

    const savedPayload = firestoreMocks.addDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(savedPayload).toEqual(expect.objectContaining({
      userId: 'owner-1',
      name: 'Spring Roster',
      version: 1,
      isArchived: false,
      metadata: expect.objectContaining({
        totalPlayers: 1,
        avgSkillRating: 7,
        hasGroups: true,
      }),
    }));

    expect(savedPayload.description).toBeUndefined();
    expect((savedPayload.players as Array<Record<string, unknown>>)[0]).not.toHaveProperty('email');
    expect(firestoreMocks.collection).toHaveBeenCalledWith({ kind: 'db' }, 'rosters');
  });

  it('blocks saving a roster when the signed-in user does not match the roster owner', async () => {
    await expect(saveRoster({
      userId: 'someone-else',
      name: 'Blocked Roster',
      players: [createPlayer({ id: 'p1', name: 'Alex Example', gender: 'M' })],
      playerGroups: [],
      teams: [],
      unassignedPlayers: [],
      config,
      version: 1,
    })).rejects.toThrow('Authentication mismatch - cannot save roster');

    expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
  });

  it('loads and normalizes a user roster list with date conversion and query constraints', async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'roster-1',
          data: () => ({
            userId: 'owner-1',
            name: 'Roster One',
            createdAt: { toDate: () => new Date('2026-04-01T10:00:00.000Z') },
            updatedAt: { toDate: () => new Date('2026-04-02T10:00:00.000Z') },
            lastAccessedAt: { toDate: () => new Date('2026-04-03T10:00:00.000Z') },
            isArchived: false,
          }),
        },
      ],
    });

    const rosters = await getUserRosters('owner-1');

    expect(rosters).toHaveLength(1);
    expect(rosters[0]).toEqual(expect.objectContaining({
      id: 'roster-1',
      name: 'Roster One',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-02T10:00:00.000Z'),
      lastAccessedAt: new Date('2026-04-03T10:00:00.000Z'),
    }));
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.where).toHaveBeenCalledWith('userId', '==', 'owner-1');
    expect(firestoreMocks.where).toHaveBeenCalledWith('isArchived', '==', false);
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('lastAccessedAt', 'desc');
    expect(firestoreMocks.limit).toHaveBeenCalledWith(50);
  });

  it('blocks roster queries for a mismatched user and returns an empty list', async () => {
    const rosters = await getUserRosters('someone-else');

    expect(rosters).toEqual([]);
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });
});
