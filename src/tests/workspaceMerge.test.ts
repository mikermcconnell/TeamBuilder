import { describe, expect, it } from 'vitest';

import { mergeWorkspaceStateForConflict } from '@/services/persistence/workspaceMerge';
import type { AppState, LeagueConfig, Player, SavedWorkspace } from '@/types';

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
};

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Alex Example',
    gender: 'M',
    skillRating: 7,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

function createAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    players: [],
    teams: [],
    unassignedPlayers: [],
    playerGroups: [],
    config,
    execRatingHistory: {},
    savedConfigs: [],
    teamIterations: [],
    activeTeamIterationId: null,
    leagueMemory: [],
    pendingWarnings: [],
    ...overrides,
  };
}

function createWorkspace(overrides: Partial<SavedWorkspace> = {}): SavedWorkspace {
  return {
    id: 'workspace-1',
    userId: 'user-1',
    name: 'Project',
    description: '',
    players: [],
    playerGroups: [],
    config,
    teams: [],
    unassignedPlayers: [],
    execRatingHistory: {},
    savedConfigs: [],
    teamIterations: [],
    activeTeamIterationId: null,
    leagueMemory: [],
    pendingWarnings: [],
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
    revision: 2,
    version: 1,
    ...overrides,
  };
}

describe('mergeWorkspaceStateForConflict', () => {
  it('keeps local draft state while merging additive collections from the latest workspace', () => {
    const localState = createAppState({
      players: [createPlayer({ id: 'local-player', name: 'Local Player' })],
      execRatingHistory: {
        alex: { rating: 8, updatedAt: 10 },
      },
      savedConfigs: [
        { ...config, id: 'local-config', name: 'Local Config' },
      ],
      teamIterations: [
        {
          id: 'local-iter',
          name: 'Local',
          type: 'manual',
          status: 'ready',
          teams: [],
          unassignedPlayers: [],
          createdAt: '2026-04-20T10:05:00.000Z',
        },
      ],
      leagueMemory: [
        {
          id: 'local-memory',
          title: 'Local Memory',
          createdAt: '2026-04-20T10:05:00.000Z',
          teams: [],
        },
      ],
      pendingWarnings: [
        {
          id: 'local-warning',
          category: 'not-found',
          message: 'Local warning',
          playerName: 'Local Player',
          requestedName: 'Missing',
          confidence: 'low',
          status: 'pending',
        },
      ],
    });

    const remoteWorkspace = createWorkspace({
      players: [createPlayer({ id: 'remote-player', name: 'Remote Player' })],
      execRatingHistory: {
        alex: { rating: 6, updatedAt: 5 },
        bailey: { rating: 7, updatedAt: 8 },
      },
      savedConfigs: [
        { ...config, id: 'remote-config', name: 'Remote Config' },
      ],
      teamIterations: [
        {
          id: 'remote-iter',
          name: 'Remote',
          type: 'generated',
          status: 'ready',
          teams: [],
          unassignedPlayers: [],
          createdAt: '2026-04-20T10:00:00.000Z',
        },
      ],
      leagueMemory: [
        {
          id: 'remote-memory',
          title: 'Remote Memory',
          createdAt: '2026-04-20T10:00:00.000Z',
          teams: [],
        },
      ],
      pendingWarnings: [
        {
          id: 'remote-warning',
          category: 'not-found',
          message: 'Remote warning',
          playerName: 'Remote Player',
          requestedName: 'Missing',
          confidence: 'low',
          status: 'pending',
        },
      ],
    });

    const merged = mergeWorkspaceStateForConflict(remoteWorkspace, localState);

    expect(merged.players).toEqual(localState.players);
    expect(merged.execRatingHistory).toEqual({
      alex: { rating: 8, updatedAt: 10 },
      bailey: { rating: 7, updatedAt: 8 },
    });
    expect(merged.savedConfigs.map(item => item.id).sort()).toEqual(['local-config', 'remote-config']);
    expect(merged.teamIterations?.map(item => item.id).sort()).toEqual(['local-iter', 'remote-iter']);
    expect(merged.leagueMemory?.map(item => item.id).sort()).toEqual(['local-memory', 'remote-memory']);
    expect(merged.pendingWarnings?.map(item => item.id).sort()).toEqual(['local-warning', 'remote-warning']);
  });
});
