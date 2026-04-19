import { describe, expect, it } from 'vitest';

import { sanitizeLoadedState } from '@/hooks/useAppPersistence';
import type { AppState, LeagueConfig, Player } from '@/types';

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

describe('sanitizeLoadedState', () => {
  it('keeps new and returning player review flags when loading saved app state', () => {
    const sanitized = sanitizeLoadedState(createAppState({
      players: [
        createPlayer({ id: 'new-player', name: 'New Player', isNewPlayer: true }),
        createPlayer({ id: 'returning-player', name: 'Returning Player', isNewPlayer: false }),
      ],
      unassignedPlayers: [
        createPlayer({ id: 'new-player', name: 'New Player', isNewPlayer: true }),
        createPlayer({ id: 'returning-player', name: 'Returning Player', isNewPlayer: false }),
      ],
    }));

    expect(sanitized?.players).toEqual([
      expect.objectContaining({ id: 'new-player', isNewPlayer: true }),
      expect.objectContaining({ id: 'returning-player', isNewPlayer: false }),
    ]);
  });

  it('preserves roster, groups, teams, ages, handlers, and zero-based ratings after sanitizing loaded state', () => {
    const player = createPlayer({
      id: 'player-1',
      name: 'Casey Complete',
      isNewPlayer: false,
      gender: 'F',
      skillRating: 0,
      execSkillRating: 0,
      isHandler: true,
      email: 'casey@example.com',
      teammateRequests: ['Taylor Team'],
      avoidRequests: ['Jordan Avoid'],
      profile: {
        age: 19,
        registrationInfo: 'Young player note',
      },
      unfulfilledRequests: [
        {
          name: 'Taylor Team',
          reason: 'partial',
        },
      ],
    });

    const sanitized = sanitizeLoadedState(createAppState({
      players: [player],
      unassignedPlayers: [player],
      teams: [
        {
          id: 'team-1',
          name: 'Blue Jays',
          players: [{ ...player, teamId: 'team-1' }],
          averageSkill: 0,
          genderBreakdown: { M: 0, F: 1, Other: 0 },
        },
      ],
      playerGroups: [
        {
          id: 'group-1',
          label: 'A',
          color: '#3B82F6',
          playerIds: ['player-1'],
          players: [{ ...player, groupId: 'group-1' }],
        },
      ],
    }));

    expect(sanitized).not.toBeNull();
    expect(sanitized?.players[0]).toEqual(expect.objectContaining({
      id: 'player-1',
      isNewPlayer: false,
      gender: 'F',
      skillRating: 0,
      execSkillRating: 0,
      isHandler: true,
      teammateRequests: ['Taylor Team'],
      avoidRequests: ['Jordan Avoid'],
      profile: expect.objectContaining({
        age: 19,
      }),
      unfulfilledRequests: [
        expect.objectContaining({
          reason: 'partial',
        }),
      ],
    }));
    expect(sanitized?.playerGroups[0]).toEqual(expect.objectContaining({
      playerIds: ['player-1'],
      players: [expect.objectContaining({ id: 'player-1', groupId: 'group-1' })],
    }));
    expect(sanitized?.teams[0]).toEqual(expect.objectContaining({
      id: 'team-1',
      players: [expect.objectContaining({ id: 'player-1', teamId: 'team-1' })],
      genderBreakdown: { M: 0, F: 1, Other: 0 },
    }));
  });
});
