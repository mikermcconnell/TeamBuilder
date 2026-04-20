import { describe, expect, it } from 'vitest';

import type { LeagueConfig, Team } from '@/types';
import { applyTeamBranding } from '@/utils/teamBranding';

function createTeam(index: number): Team {
  return {
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    players: [],
    averageSkill: 0,
    genderBreakdown: { M: 0, F: 0, Other: 0 },
  };
}

describe('applyTeamBranding', () => {
  it('uses unique mascots before repeating when branding more than eight teams', () => {
    const teams = Array.from({ length: 10 }, (_, index) => createTeam(index));
    const config: LeagueConfig = {
      id: 'default',
      name: 'Default League',
      maxTeamSize: 11,
      minFemales: 3,
      minMales: 8,
      targetTeams: 10,
      allowMixedGender: true,
    };

    const brandedTeams = applyTeamBranding(teams, [], config, { forceRename: true });
    const mascots = brandedTeams.map(team => team.name.split(' ').at(-1));

    expect(new Set(mascots).size).toBe(10);
    expect(mascots).toEqual([
      'Comets',
      'Wolves',
      'Storm',
      'Foxes',
      'Falcons',
      'Waves',
      'Blaze',
      'Rockets',
      'Chargers',
      'Titans',
    ]);
  });
});
