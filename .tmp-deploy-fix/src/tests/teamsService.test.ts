import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(() => ({ kind: 'collection' })),
  deleteDoc: vi.fn(),
  doc: vi.fn((...args: unknown[]) => {
    const [, collectionName, id] = args as [unknown, string, string];
    return { kind: 'doc', path: `${collectionName}/${id}` };
  }),
  getDocs: vi.fn(),
  limit: vi.fn((value: number) => ({ kind: 'limit', value })),
  orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
  query: vi.fn((...args: unknown[]) => ({ kind: 'query', args })),
  Timestamp: class MockTimestamp {
    static now = vi.fn(() => new MockTimestamp());
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

import { deleteTeams, getUserTeams, saveTeams, updateTeams } from '@/services/teamsService';
import type { LeagueConfig, Player, Team, TeamsData } from '@/types';

function createPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'gender'>): Player {
  return {
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

describe('teamsService', () => {
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

    firestoreMocks.addDoc.mockResolvedValue({ id: 'teams-123' });
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] });
    firestoreMocks.updateDoc.mockResolvedValue(undefined);
    firestoreMocks.deleteDoc.mockResolvedValue(undefined);
  });

  it('saves teams for the authenticated user and strips undefined values from nested players', async () => {
    const teamsData: Omit<TeamsData, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: 'owner-1',
      rosterId: 'roster-1',
      name: 'Spring Teams',
      description: undefined,
      teams: [
        {
          id: 'team-1',
          name: 'Team One',
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
        },
      ],
      unassignedPlayers: [],
      config,
      generationMethod: 'balanced',
    };

    const savedId = await saveTeams(teamsData);

    expect(savedId).toBe('teams-123');
    expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.collection).toHaveBeenCalledWith({ kind: 'db' }, 'teams');

    const savedPayload = firestoreMocks.addDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(savedPayload).toEqual(expect.objectContaining({
      userId: 'owner-1',
      rosterId: 'roster-1',
      name: 'Spring Teams',
      createdAt: expect.any(firestoreMocks.Timestamp),
      updatedAt: expect.any(firestoreMocks.Timestamp),
    }));
    expect(savedPayload.description).toBeUndefined();
    expect((savedPayload.teams as Array<Team>)[0].players[0]).not.toHaveProperty('email');
  });

  it('blocks saving teams when the signed-in user does not match the team owner', async () => {
    await expect(saveTeams({
      userId: 'someone-else',
      name: 'Blocked Teams',
      teams: [],
      unassignedPlayers: [],
      config,
      generationMethod: 'balanced',
    })).rejects.toThrow('Authentication mismatch');

    expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
  });

  it('loads saved teams for the current user and converts timestamps to dates', async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'teams-1',
          data: () => ({
            userId: 'owner-1',
            rosterId: 'roster-1',
            name: 'Spring Teams',
            createdAt: { toDate: () => new Date('2026-04-01T10:00:00.000Z') },
            updatedAt: { toDate: () => new Date('2026-04-02T10:00:00.000Z') },
          }),
        },
      ],
    });

    const teams = await getUserTeams('owner-1', 'roster-1');

    expect(teams).toHaveLength(1);
    expect(teams[0]).toEqual(expect.objectContaining({
      id: 'teams-1',
      rosterId: 'roster-1',
      name: 'Spring Teams',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    }));
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.where).toHaveBeenCalledWith('userId', '==', 'owner-1');
    expect(firestoreMocks.where).toHaveBeenCalledWith('rosterId', '==', 'roster-1');
    expect(firestoreMocks.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
  });

  it('blocks team queries for a mismatched user and returns an empty list', async () => {
    const teams = await getUserTeams('someone-else');

    expect(teams).toEqual([]);
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('updates teams while stripping undefined values and setting a fresh timestamp', async () => {
    await updateTeams('teams-1', {
      userId: 'owner-1',
      description: undefined,
      teams: [
        {
          id: 'team-1',
          name: 'Team One',
          players: [
            createPlayer({ id: 'p1', name: 'Alex Example', gender: 'M', skillRating: 7, email: undefined }),
          ],
          averageSkill: 7,
          genderBreakdown: { M: 1, F: 0, Other: 0 },
        },
      ],
    });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1);
    const updatePayload = firestoreMocks.updateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updatePayload).toEqual(expect.objectContaining({
      userId: 'owner-1',
      updatedAt: expect.any(firestoreMocks.Timestamp),
    }));
    expect(updatePayload.description).toBeUndefined();
    expect((updatePayload.teams as Array<Team>)[0].players[0]).not.toHaveProperty('email');
  });

  it('deletes a saved teams document for the authenticated user', async () => {
    await deleteTeams('teams-1');

    expect(firestoreMocks.deleteDoc).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'doc',
      path: 'teams/teams-1',
    }));
  });
});
