import { describe, expect, it } from 'vitest';

import type { LeagueConfig, LeagueMemoryEntry, Player, Team, TeamIteration } from '@/types';
import { buildIterationInsights, buildManualMoveRecommendations, compareIterationInsights, createLeagueMemoryEntry } from '@/utils/teamInsights';

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 3,
  minFemales: 1,
  minMales: 1,
  targetTeams: 2,
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

function createTeam(overrides: Partial<Team> & Pick<Team, 'id' | 'name' | 'players'>): Team {
  const players = overrides.players;
  const genderBreakdown = players.reduce((acc, player) => {
    acc[player.gender] += 1;
    return acc;
  }, { M: 0, F: 0, Other: 0 });

  return {
    averageSkill: players.reduce((sum, player) => sum + (player.execSkillRating ?? player.skillRating), 0) / Math.max(players.length, 1),
    handlerCount: players.filter(player => player.isHandler).length,
    genderBreakdown,
    ...overrides,
  };
}

function createIteration(id: string, name: string, teams: Team[]): TeamIteration {
  return {
    id,
    name,
    type: 'manual',
    status: 'ready',
    teams,
    unassignedPlayers: [],
    createdAt: '2026-04-10T12:00:00.000Z',
  };
}

describe('teamInsights', () => {
  it('builds explainable insights for an iteration', () => {
    const balancedIteration = createIteration('iter-1', 'Balanced', [
      createTeam({
        id: 'team-1',
        name: 'Team 1',
        players: [
          createPlayer({ id: 'a', name: 'Alice', gender: 'F', skillRating: 8, isHandler: true }),
          createPlayer({ id: 'b', name: 'Ben', gender: 'M', skillRating: 7 }),
        ],
      }),
      createTeam({
        id: 'team-2',
        name: 'Team 2',
        players: [
          createPlayer({ id: 'c', name: 'Cara', gender: 'F', skillRating: 8 }),
          createPlayer({ id: 'd', name: 'Dan', gender: 'M', skillRating: 7, isHandler: true }),
        ],
      }),
    ]);

    const memory: LeagueMemoryEntry[] = [
      createLeagueMemoryEntry(balancedIteration, 'Last season'),
    ];

    const insights = buildIterationInsights(balancedIteration, config, memory);

    expect(insights.score.total).toBeGreaterThan(0);
    expect(insights.skillSpread).toBeLessThanOrEqual(0.1);
    expect(insights.strengths.length).toBeGreaterThan(0);
    expect(typeof insights.summary).toBe('string');
  });

  it('compares two iterations and recommends the stronger one', () => {
    const strongIteration = buildIterationInsights(createIteration('iter-1', 'Balanced', [
      createTeam({
        id: 'team-1',
        name: 'Team 1',
        players: [
          createPlayer({ id: 'a', name: 'Alice', gender: 'F', skillRating: 8, isHandler: true }),
          createPlayer({ id: 'b', name: 'Ben', gender: 'M', skillRating: 7 }),
        ],
      }),
      createTeam({
        id: 'team-2',
        name: 'Team 2',
        players: [
          createPlayer({ id: 'c', name: 'Cara', gender: 'F', skillRating: 8 }),
          createPlayer({ id: 'd', name: 'Dan', gender: 'M', skillRating: 7, isHandler: true }),
        ],
      }),
    ]), config);

    const weakerIteration = buildIterationInsights(createIteration('iter-2', 'Stacked', [
      createTeam({
        id: 'team-1',
        name: 'Team 1',
        players: [
          createPlayer({ id: 'e', name: 'Ella', gender: 'F', skillRating: 10, isHandler: true }),
          createPlayer({ id: 'f', name: 'Finn', gender: 'M', skillRating: 10, isHandler: true }),
        ],
      }),
      createTeam({
        id: 'team-2',
        name: 'Team 2',
        players: [
          createPlayer({ id: 'g', name: 'Gia', gender: 'F', skillRating: 2 }),
          createPlayer({ id: 'h', name: 'Hank', gender: 'M', skillRating: 2 }),
        ],
      }),
    ]), config);

    const comparison = compareIterationInsights(strongIteration, weakerIteration);

    expect(comparison.recommendedIterationId).toBe('iter-1');
    expect(comparison.reasons.length).toBeGreaterThan(0);
  });

  it('suggests better manual move targets for a dragged player', () => {
    const teams = [
      createTeam({
        id: 'team-1',
        name: 'Team 1',
        players: [
          createPlayer({ id: 'a', name: 'Alice', gender: 'F', skillRating: 9, isHandler: true }),
          createPlayer({ id: 'b', name: 'Ben', gender: 'M', skillRating: 8, isHandler: true }),
        ],
      }),
      createTeam({
        id: 'team-2',
        name: 'Team 2',
        players: [
          createPlayer({ id: 'c', name: 'Cara', gender: 'F', skillRating: 4 }),
          createPlayer({ id: 'd', name: 'Dan', gender: 'M', skillRating: 4 }),
        ],
      }),
    ];

    const recommendations = buildManualMoveRecommendations('a', teams, config);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.targetTeamId).toBe('team-2');
  });
});
