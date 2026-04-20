import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn((...segments: unknown[]) => ({ path: segments.slice(1).join('/') })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('@/config/firebase', () => ({
  db: { kind: 'mock-db' },
}));

vi.mock('firebase/firestore', () => ({
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  setDoc: firestoreMocks.setDoc,
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

function createPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'gender'>): Player {
  return {
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

describe('Firebase-style app state persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    dataStorageService.setUser({ uid: 'user-123' } as never);
    firestoreMocks.setDoc.mockResolvedValue(undefined);
    firestoreMocks.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
  });

  it('preserves execSkillRating values and nulls when saving cloud-backed app state', async () => {
    const appState: AppState = {
      players: [
        createPlayer({ id: 'p1', name: 'Rated Player', gender: 'M', execSkillRating: 8.5 }),
        createPlayer({ id: 'p2', name: 'NA Player', gender: 'F', execSkillRating: null }),
      ],
      teams: [],
      unassignedPlayers: [],
      playerGroups: [],
      config,
      execRatingHistory: {},
      savedConfigs: [],
    };

    await dataStorageService.save(appState);

    const savedPayload = firestoreMocks.setDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    const savedPlayers = savedPayload.players as Player[];
    expect(savedPlayers[0]?.execSkillRating).toBe(8.5);
    expect(savedPlayers[1]?.execSkillRating).toBeNull();
  });

  it('preserves execSkillRating values and nulls when loading cloud-backed app state', async () => {
    const cloudState: AppState = {
      players: [
        createPlayer({ id: 'p1', name: 'Rated Player', gender: 'M', execSkillRating: 7 }),
        createPlayer({ id: 'p2', name: 'NA Player', gender: 'F', execSkillRating: null }),
      ],
      teams: [],
      unassignedPlayers: [],
      playerGroups: [],
      config,
      execRatingHistory: {},
      savedConfigs: [],
    };

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        ...cloudState,
        lastUpdated: '2026-04-10T12:00:00.000Z',
      }),
    });

    const loaded = await dataStorageService.load();

    expect(loaded?.players[0]?.execSkillRating).toBe(7);
    expect(loaded?.players[1]?.execSkillRating).toBeNull();
  });
});
