import { describe, expect, it } from 'vitest';

import type { Player, Team } from '@/types';
import { buildTeamSkillSpreadSummary } from '@/utils/teamSummary';

function createPlayer(
  id: string,
  name: string,
  gender: 'M' | 'F',
  skillRating: number,
): Player {
  return {
    id,
    name,
    gender,
    skillRating,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
  };
}

function createTeam(id: string, name: string, players: Player[]): Team {
  return {
    id,
    name,
    players,
    averageSkill: players.reduce((sum, player) => sum + player.skillRating, 0) / Math.max(players.length, 1),
    genderBreakdown: players.reduce((acc, player) => {
      acc[player.gender] += 1;
      return acc;
    }, { M: 0, F: 0, Other: 0 }),
    handlerCount: 0,
  };
}

describe('teamSummary', () => {
  it('builds overall, male, and female skill spread metrics', () => {
    const teams = [
      createTeam('team-1', 'Blaze', [
        createPlayer('f1', 'Alice', 'F', 8),
        createPlayer('m1', 'Ben', 'M', 6),
      ]),
      createTeam('team-2', 'Chargers', [
        createPlayer('f2', 'Cara', 'F', 6),
        createPlayer('m2', 'Dan', 'M', 8),
      ]),
      createTeam('team-3', 'Comets', [
        createPlayer('f3', 'Eve', 'F', 7),
        createPlayer('m3', 'Finn', 'M', 7),
      ]),
    ];

    const summary = buildTeamSkillSpreadSummary(teams);

    expect(summary.overall.spread).toBe(0);
    expect(summary.overall.lowestAverage).toBe(7);
    expect(summary.overall.highestAverage).toBe(7);

    expect(summary.female.spread).toBe(2);
    expect(summary.female.lowestAverage).toBe(6);
    expect(summary.female.highestAverage).toBe(8);

    expect(summary.male.spread).toBe(2);
    expect(summary.male.lowestAverage).toBe(6);
    expect(summary.male.highestAverage).toBe(8);
  });

  it('ignores teams with no players of the requested gender', () => {
    const teams = [
      createTeam('team-1', 'Blaze', [
        createPlayer('f1', 'Alice', 'F', 8),
      ]),
      createTeam('team-2', 'Chargers', [
        createPlayer('f2', 'Cara', 'F', 6),
      ]),
    ];

    const summary = buildTeamSkillSpreadSummary(teams);

    expect(summary.male.spread).toBeNull();
    expect(summary.male.contributingTeamCount).toBe(0);
    expect(summary.female.spread).toBe(2);
  });
});
