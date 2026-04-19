import { describe, expect, it } from 'vitest';

import type { LeagueConfig, Player, Team } from '@/types';
import { generateBalancedTeams, wouldSwapBreakGenderConstraints } from '@/utils/teamGenerator';

function createPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'gender'>): Player {
  return {
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

function createConfig(overrides: Partial<LeagueConfig> = {}): LeagueConfig {
  return {
    id: 'league-1',
    name: 'League',
    maxTeamSize: 2,
    minFemales: 0,
    minMales: 0,
    targetTeams: 2,
    allowMixedGender: true,
    ...overrides,
  };
}

function teamIds(team: Team): string[] {
  return team.players.map(player => player.id).sort();
}

function effectiveSkill(player: Player): number {
  return player.execSkillRating !== null ? player.execSkillRating : player.skillRating;
}

describe('generateBalancedTeams', () => {
  it('keeps teams single-gender when mixed gender teams are disabled', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M', skillRating: 7 }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'M', skillRating: 6 }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'F', skillRating: 8 }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F', skillRating: 5 }),
    ];

    const result = generateBalancedTeams(players, createConfig({ allowMixedGender: false }), []);

    expect(result.unassignedPlayers).toHaveLength(0);
    expect(result.teams).toHaveLength(2);
    expect(result.teams.every(team => new Set(team.players.map(player => player.gender)).size <= 1)).toBe(true);
  });

  it('leaves overflow players unassigned when team capacity is too small', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M', skillRating: 7 }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F', skillRating: 6 }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M', skillRating: 8 }),
    ];

    const result = generateBalancedTeams(players, createConfig({ allowMixedGender: true, maxTeamSize: 1, targetTeams: 2 }), []);

    expect(result.teams).toHaveLength(2);
    expect(result.teams.every(team => team.players.length <= 1)).toBe(true);
    expect(result.unassignedPlayers).toHaveLength(1);
    expect(result.unassignedPlayers[0]?.id).toBe('p3');
  });

  it('keeps avoid-request conflicts off the same team', () => {
    const players: Player[] = [
      createPlayer({
        id: 'p1',
        name: 'Alex',
        gender: 'M',
        avoidRequests: ['Blair'],
        skillRating: 8,
      }),
      createPlayer({
        id: 'p2',
        name: 'Blair',
        gender: 'F',
        avoidRequests: ['Alex'],
        skillRating: 7,
      }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M', skillRating: 6 }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F', skillRating: 5 }),
    ];

    const result = generateBalancedTeams(players, createConfig({ allowMixedGender: true }), []);
    const teamContainingAlex = result.teams.find(team => teamIds(team).includes('p1'));
    const teamContainingBlair = result.teams.find(team => teamIds(team).includes('p2'));

    expect(result.unassignedPlayers).toHaveLength(0);
    expect(teamContainingAlex).toBeDefined();
    expect(teamContainingBlair).toBeDefined();
    expect(teamContainingAlex?.id).not.toBe(teamContainingBlair?.id);
  });

  it('leaves everyone unassigned in manual mode and still creates the requested team tabs', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M', skillRating: 7 }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F', skillRating: 6 }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M', skillRating: 8 }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F', skillRating: 5 }),
    ];

    const result = generateBalancedTeams(players, createConfig({ allowMixedGender: true }), [], false, true);

    expect(result.teams).toHaveLength(2);
    expect(result.teams.every(team => team.players.length === 0)).toBe(true);
    expect(result.unassignedPlayers.map(player => player.id).sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(result.stats.totalPlayers).toBe(4);
    expect(result.stats.assignedPlayers).toBe(0);
    expect(result.stats.unassignedPlayers).toBe(4);
  });

  it('calculates team averages from exec ratings when they are present', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M', skillRating: 1, execSkillRating: 9 }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F', skillRating: 9, execSkillRating: 1 }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M', skillRating: 6, execSkillRating: 6 }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F', skillRating: 4, execSkillRating: null }),
    ];

    const result = generateBalancedTeams(players, createConfig({ allowMixedGender: true, maxTeamSize: 2, targetTeams: 2 }), []);

    expect(result.unassignedPlayers).toHaveLength(0);
    expect(result.teams).toHaveLength(2);
    expect(result.teams.flatMap(team => team.players).map(player => player.id).sort()).toEqual(['p1', 'p2', 'p3', 'p4']);

    result.teams.forEach(team => {
      const expectedAverage = team.players.reduce((sum, player) => sum + effectiveSkill(player), 0) / team.players.length;
      expect(team.averageSkill).toBeCloseTo(expectedAverage, 5);
    });
  });

  it('tries to spread new players across teams as a soft preference', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M', skillRating: 5 }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F', skillRating: 5 }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M', skillRating: 5, isNewPlayer: true }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F', skillRating: 5 }),
      createPlayer({ id: 'p5', name: 'Evan', gender: 'M', skillRating: 5, isNewPlayer: true }),
      createPlayer({ id: 'p6', name: 'Finley', gender: 'F', skillRating: 5 }),
    ];

    const result = generateBalancedTeams(
      players,
      createConfig({ allowMixedGender: true, maxTeamSize: 3, targetTeams: 2 }),
      []
    );

    const newPlayersPerTeam = result.teams.map(team =>
      team.players.filter(player => player.isNewPlayer).length
    );

    expect(result.unassignedPlayers).toHaveLength(0);
    expect(result.teams).toHaveLength(2);
    expect(newPlayersPerTeam.sort((a, b) => a - b)).toEqual([1, 1]);
  });

  it('does not split a hard player group during the post-assignment balancing step', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M', skillRating: 10, groupId: 'group-1' }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F', skillRating: 2, groupId: 'group-1' }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M', skillRating: 9 }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F', skillRating: 1 }),
    ];

    const playerGroups = [
      {
        id: 'group-1',
        label: 'A',
        color: '#3B82F6',
        playerIds: ['p1', 'p2'],
        players: [players[0], players[1]].filter(Boolean) as Player[],
      },
    ];

    const result = generateBalancedTeams(
      players,
      createConfig({ allowMixedGender: true, maxTeamSize: 2, targetTeams: 2 }),
      playerGroups
    );

    const groupedTeamIds = result.teams
      .filter(team => team.players.some(player => player.id === 'p1' || player.id === 'p2'))
      .map(team => team.id);

    expect(result.unassignedPlayers).toHaveLength(0);
    expect(new Set(groupedTeamIds).size).toBe(1);
  });

  it('blocks balancing swaps that would break gender minimums', () => {
    const config = createConfig({ allowMixedGender: true, maxTeamSize: 12, minFemales: 4, minMales: 7 });
    const team1: Team = {
      id: 'team-1',
      name: 'Team 1',
      players: [],
      averageSkill: 6,
      genderBreakdown: { M: 8, F: 4, Other: 0 },
      handlerCount: 0,
    };
    const team2: Team = {
      id: 'team-2',
      name: 'Team 2',
      players: [],
      averageSkill: 6,
      genderBreakdown: { M: 7, F: 5, Other: 0 },
      handlerCount: 0,
    };

    const femalePlayer = createPlayer({ id: 'p1', name: 'Alex', gender: 'F', skillRating: 8 });
    const malePlayer = createPlayer({ id: 'p2', name: 'Blair', gender: 'M', skillRating: 5 });

    expect(wouldSwapBreakGenderConstraints(team1, team2, femalePlayer, malePlayer, config)).toBe(true);
  });

  it('respects target team count and can still place a balanced roster in random mode', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M', skillRating: 7 }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F', skillRating: 6 }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M', skillRating: 8 }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F', skillRating: 5 }),
    ];

    const result = generateBalancedTeams(players, createConfig({ allowMixedGender: true }), [], true, false);

    expect(result.teams).toHaveLength(2);
    expect(result.unassignedPlayers).toHaveLength(0);
    expect(result.teams.every(team => team.players.length === 2)).toBe(true);
  });

  it('rounds odd auto-calculated team counts up to the next even number by default', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M' }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F' }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M' }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F' }),
      createPlayer({ id: 'p5', name: 'Evan', gender: 'M' }),
    ];

    const result = generateBalancedTeams(players, createConfig({ maxTeamSize: 2, targetTeams: undefined }), []);

    expect(result.teams).toHaveLength(4);
  });

  it('keeps odd target team counts when the restriction is disabled', () => {
    const players: Player[] = [
      createPlayer({ id: 'p1', name: 'Alex', gender: 'M' }),
      createPlayer({ id: 'p2', name: 'Blair', gender: 'F' }),
      createPlayer({ id: 'p3', name: 'Casey', gender: 'M' }),
      createPlayer({ id: 'p4', name: 'Drew', gender: 'F' }),
      createPlayer({ id: 'p5', name: 'Evan', gender: 'M' }),
    ];

    const result = generateBalancedTeams(
      players,
      createConfig({ maxTeamSize: 2, targetTeams: undefined, restrictToEvenTeams: false }),
      []
    );

    expect(result.teams).toHaveLength(3);
  });

});
