import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDoc, mockGetDoc, mockSetDoc, mockServerTimestamp, MockTimestamp } = vi.hoisted(() => ({
  mockDoc: vi.fn((...segments: unknown[]) => ({ path: segments.slice(1).join('/') })),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ kind: 'server-timestamp' })),
  MockTimestamp: class MockTimestamp {
    constructor(private readonly iso: string) {}
    toDate() {
      return new Date(this.iso);
    }
  },
}));

vi.mock('@/config/firebase', () => ({
  db: { kind: 'mock-db' },
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  Timestamp: MockTimestamp,
}));

import { dataStorageService } from '@/services/dataStorageService';
import type { AppState, LeagueConfig, Player } from '@/types';

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
};

const player: Player = {
  id: 'player-1',
  name: 'Alex Example',
  isNewPlayer: true,
  gender: 'M',
  skillRating: 7,
  execSkillRating: null,
  teammateRequests: [],
  avoidRequests: [],
};

const appState: AppState = {
  players: [player],
  teams: [],
  unassignedPlayers: [player],
  playerGroups: [],
  config,
  execRatingHistory: {},
  savedConfigs: [],
};

describe('DataStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    dataStorageService.setUser(null);
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('stores anonymous device data in an anonymous-scoped key', async () => {
    await dataStorageService.save(appState);

    expect(localStorage.getItem('teamBuilderState:anonymous')).toBeTruthy();
    expect(localStorage.getItem('teamBuilderState')).toBeNull();
  });

  it('stores signed-in device data in a user-scoped key', async () => {
    dataStorageService.setUser({ uid: 'user-123' } as never);

    await dataStorageService.save(appState);

    expect(localStorage.getItem('teamBuilderState:user:user-123')).toBeTruthy();
    expect(localStorage.getItem('teamBuilderState')).toBeNull();
  });

  it('preserves new-player flags when saving signed-in device data to Firestore', async () => {
    dataStorageService.setUser({ uid: 'user-123' } as never);

    await dataStorageService.save(appState);

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-123/data/appState' }),
      expect.objectContaining({
        players: [
          expect.objectContaining({
            id: 'player-1',
            isNewPlayer: true,
          }),
        ],
        updatedAtServer: expect.objectContaining({ kind: 'server-timestamp' }),
      })
    );
  });

  it('persists all core roster, group, and team fields in device/app Firebase saves', async () => {
    dataStorageService.setUser({ uid: 'user-123' } as never);

    const richPlayer: Player = {
      ...player,
      id: 'player-rich',
      name: 'Rich Player',
      isNewPlayer: false,
      gender: 'F',
      skillRating: 0,
      execSkillRating: 0,
      isHandler: true,
      email: 'rich@example.com',
      teammateRequests: ['Teammate One'],
      avoidRequests: ['Avoid One'],
      profile: {
        age: 42,
        registrationInfo: 'Veteran player',
      },
      groupId: 'group-1',
      teamId: 'team-1',
    };

    await dataStorageService.save({
      ...appState,
      players: [richPlayer],
      unassignedPlayers: [],
      playerGroups: [
        {
          id: 'group-1',
          label: 'A',
          color: '#3B82F6',
          playerIds: [richPlayer.id],
          players: [richPlayer],
        },
      ],
      teams: [
        {
          id: 'team-1',
          name: 'Blue Jays',
          players: [richPlayer],
          averageSkill: 0,
          genderBreakdown: { M: 0, F: 1, Other: 0 },
        },
      ],
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-123/data/appState' }),
      expect.objectContaining({
        players: [
          expect.objectContaining({
            id: 'player-rich',
            isNewPlayer: false,
            gender: 'F',
            skillRating: 0,
            execSkillRating: 0,
            isHandler: true,
            teammateRequests: ['Teammate One'],
            avoidRequests: ['Avoid One'],
            profile: expect.objectContaining({
              age: 42,
            }),
            groupId: 'group-1',
            teamId: 'team-1',
          }),
        ],
        playerGroups: [
          expect.objectContaining({
            id: 'group-1',
            playerIds: ['player-rich'],
          }),
        ],
        teams: [
          expect.objectContaining({
            id: 'team-1',
            players: [expect.objectContaining({ id: 'player-rich' })],
          }),
        ],
      })
    );
  });

  it('does not import legacy shared local data into a signed-in account', async () => {
    localStorage.setItem('teamBuilderState', JSON.stringify({
      data: appState,
      lastUpdated: '2026-03-20T10:00:00.000Z',
    }));
    dataStorageService.setUser({ uid: 'user-123' } as never);

    const loaded = await dataStorageService.load();

    expect(loaded).toBeNull();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('redacts sensitive player fields from the local recovery cache', async () => {
    const sensitivePlayer: Player = {
      ...player,
      id: 'player-sensitive',
      email: 'sensitive@example.com',
      profile: {
        age: 33,
        registrationInfo: 'Private notes',
      },
    };

    await dataStorageService.save({
      ...appState,
      players: [sensitivePlayer],
      unassignedPlayers: [sensitivePlayer],
    });

    const savedSnapshot = JSON.parse(localStorage.getItem('teamBuilderState:anonymous') || '{}') as {
      data?: AppState;
    };

    expect(savedSnapshot.data?.players[0]).toEqual(expect.objectContaining({
      id: 'player-sensitive',
      profile: { age: 33 },
    }));
    expect(savedSnapshot.data?.players[0]).not.toHaveProperty('email');
    expect(savedSnapshot.data?.players[0]).not.toHaveProperty('registrationInfo');
  });
});
