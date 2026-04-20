import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDoc, mockGetDoc, mockSetDoc } = vi.hoisted(() => ({
  mockDoc: vi.fn((...segments: unknown[]) => ({ path: segments.slice(1).join('/') })),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
}));

vi.mock('@/config/firebase', () => ({
  db: { kind: 'mock-db' },
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
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
});
