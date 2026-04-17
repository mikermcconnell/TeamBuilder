import { describe, expect, it } from 'vitest';

import type { LeagueConfig, Player, Team } from '@/types';
import { reconcileTeamState } from '@/utils/teamStateReconciler';

const config: LeagueConfig = {
  id: 'config-1',
  name: 'Test League',
  maxTeamSize: 12,
  minFemales: 0,
  minMales: 0,
  targetTeams: 1,
  allowMixedGender: true,
  restrictToEvenTeams: false,
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

function createTeam(players: Player[]): Team {
  return {
    id: 'team-1',
    name: 'Team 1',
    players,
    averageSkill: 0,
    genderBreakdown: { M: 0, F: 0, Other: 0 },
    handlerCount: 0,
  };
}

describe('reconcileTeamState', () => {
  it('refreshes stale request outcomes from the actual team assignments', () => {
    const alex = createPlayer({
      id: 'alex',
      name: 'Alex Smith',
      gender: 'M',
      teammateRequests: ['Jamie Lee'],
      teammateRequestsParsed: [
        {
          name: 'Jamie Lee',
          priority: 'must-have',
          matchedPlayerId: 'jamie',
          status: 'unfulfilled',
        },
      ],
      unfulfilledRequests: [
        {
          playerId: 'jamie',
          name: 'Jamie Lee',
          reason: 'non-reciprocal',
          priority: 'must-have',
        },
      ],
    });
    const jamie = createPlayer({
      id: 'jamie',
      name: 'Jamie Lee',
      gender: 'F',
      teammateRequests: ['Alex Smith'],
      teammateRequestsParsed: [
        {
          name: 'Alex Smith',
          priority: 'must-have',
          matchedPlayerId: 'alex',
          status: 'unfulfilled',
        },
      ],
      unfulfilledRequests: [
        {
          playerId: 'alex',
          name: 'Alex Smith',
          reason: 'non-reciprocal',
          priority: 'must-have',
        },
      ],
    });

    const reconciled = reconcileTeamState(
      [alex, jamie],
      [createTeam([alex, jamie])],
      [],
      [],
      config,
      undefined,
    );

    const reconciledAlex = reconciled.players.find(player => player.id === 'alex');
    const reconciledJamie = reconciled.players.find(player => player.id === 'jamie');

    expect(reconciledAlex?.teammateRequestsParsed?.[0]?.status).toBe('honored');
    expect(reconciledJamie?.teammateRequestsParsed?.[0]?.status).toBe('honored');
    expect(reconciledAlex?.unfulfilledRequests).toEqual([]);
    expect(reconciledJamie?.unfulfilledRequests).toEqual([]);
    expect(reconciled.stats?.mustHaveRequestsHonored).toBe(2);
    expect(reconciled.stats?.mustHaveRequestsBroken).toBe(0);
  });

  it('uses the exact matched requested player when similar full names exist', () => {
    const carly = createPlayer({
      id: 'carly',
      name: 'Carly Munce',
      gender: 'F',
      teammateRequests: ['Thomas Black'],
    });
    const thomasBarnes = createPlayer({
      id: 'thomas-barnes',
      name: 'Thomas Barnes',
      gender: 'M',
    });
    const thomasBlack = createPlayer({
      id: 'thomas-black',
      name: 'Thomas Black',
      gender: 'M',
    });

    const teamOne: Team = {
      id: 'team-1',
      name: 'Team 1',
      players: [carly, thomasBlack],
      averageSkill: 0,
      genderBreakdown: { M: 0, F: 0, Other: 0 },
      handlerCount: 0,
    };
    const teamTwo: Team = {
      id: 'team-2',
      name: 'Team 2',
      players: [thomasBarnes],
      averageSkill: 0,
      genderBreakdown: { M: 0, F: 0, Other: 0 },
      handlerCount: 0,
    };

    const reconciled = reconcileTeamState(
      [carly, thomasBarnes, thomasBlack],
      [teamOne, teamTwo],
      [],
      [],
      { ...config, targetTeams: 2 },
      undefined,
    );

    expect(reconciled.stats?.mustHaveRequestsHonored).toBe(1);
    expect(reconciled.stats?.mustHaveRequestsBroken).toBe(0);
    expect(reconciled.players.find(player => player.id === 'carly')?.teammateRequestsParsed?.[0]?.matchedPlayerId).toBe('thomas-black');
  });
});
