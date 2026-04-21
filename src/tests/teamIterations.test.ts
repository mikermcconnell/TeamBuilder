import { describe, expect, it } from 'vitest';

import type { AppState, TeamIteration } from '@/types';
import { getDefaultConfig } from '@/utils/configManager';
import { createCopiedTeamIteration, deleteTeamIterationFromState, ensureTeamIterations, getUniqueIterationName } from '@/utils/teamIterations';

describe('team iteration normalization', () => {
  it('handles legacy iterations with missing arrays', () => {
    const brokenIteration = {
      id: 'legacy-ai-1',
      name: 'AI 1',
      type: 'ai',
      status: 'ready',
      createdAt: '2026-03-18T00:00:00.000Z',
    } as TeamIteration;

    const state = {
      players: [],
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: getDefaultConfig(),
      teamIterations: [brokenIteration],
      activeTeamIterationId: brokenIteration.id,
    } satisfies Pick<
      AppState,
      'players' | 'teams' | 'unassignedPlayers' | 'stats' | 'playerGroups' | 'config' | 'teamIterations' | 'activeTeamIterationId'
    >;

    const result = ensureTeamIterations(state);

    expect(result.activeTeamIterationId).toBe('legacy-ai-1');
    expect(result.teamIterations).toHaveLength(1);
    expect(result.teamIterations[0]?.teams).toEqual([]);
    expect(result.teamIterations[0]?.unassignedPlayers).toEqual([]);
  });

  it('does not crash when legacy top-level teams are missing players arrays', () => {
    const state = {
      players: [],
      teams: [
        {
          id: 'legacy-team-1',
          name: 'Blue Comets',
          averageSkill: 0,
          genderBreakdown: { M: 0, F: 0, Other: 0 },
        },
      ],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: getDefaultConfig(),
      teamIterations: [],
      activeTeamIterationId: null,
    } as unknown as Pick<
      AppState,
      'players' | 'teams' | 'unassignedPlayers' | 'stats' | 'playerGroups' | 'config' | 'teamIterations' | 'activeTeamIterationId'
    >;

    const result = ensureTeamIterations(state);

    expect(result.teamIterations).toHaveLength(1);
    expect(result.teamIterations[0]?.teams).toHaveLength(1);
    expect(result.teamIterations[0]?.teams[0]?.players).toEqual([]);
  });

  it('creates copied iterations with unique tab and team names', () => {
    const originalIteration: TeamIteration = {
      id: 'manual-1',
      name: 'Manual 1',
      type: 'manual',
      status: 'ready',
      createdAt: '2026-03-18T00:00:00.000Z',
      teams: [
        {
          id: 'team-1',
          name: 'Blue Comets',
          players: [],
          averageSkill: 0,
          genderBreakdown: { M: 0, F: 0, Other: 0 },
        },
        {
          id: 'team-2',
          name: 'Green Wolves',
          players: [],
          averageSkill: 0,
          genderBreakdown: { M: 0, F: 0, Other: 0 },
        },
      ],
      unassignedPlayers: [],
    };

    const existingIterations: TeamIteration[] = [
      originalIteration,
      {
        ...originalIteration,
        id: 'manual-1-copy',
        name: 'Manual 1 Copy',
        teams: originalIteration.teams.map(team => ({
          ...team,
          id: `${team.id}-copy`,
          name: `${team.name} 2`,
        })),
      },
    ];

    const result = createCopiedTeamIteration(originalIteration, existingIterations);

    expect(result.id).not.toBe(originalIteration.id);
    expect(result.name).toBe('Manual 1 Copy 2');
    expect(result.teams.map(team => team.name)).toEqual(['Blue Wolves', 'Green Storm']);
  });

  it('avoids stacking copy labels when duplicating a copied tab', () => {
    const copiedIteration: TeamIteration = {
      id: 'manual-1-copy',
      name: 'Manual 1 Copy',
      type: 'manual',
      status: 'ready',
      createdAt: '2026-03-18T00:00:00.000Z',
      teams: [],
      unassignedPlayers: [],
    };

    const result = createCopiedTeamIteration(copiedIteration, [copiedIteration]);

    expect(result.name).toBe('Manual 1 Copy 2');
  });

  it('creates a unique renamed iteration name when the requested name is already used', () => {
    const iterations: TeamIteration[] = [
      {
        id: 'manual-1',
        name: 'Reviewed Draft',
        type: 'manual',
        status: 'ready',
        createdAt: '2026-03-18T00:00:00.000Z',
        teams: [],
        unassignedPlayers: [],
      },
      {
        id: 'manual-2',
        name: 'Playoff Draft',
        type: 'manual',
        status: 'ready',
        createdAt: '2026-03-18T00:00:00.000Z',
        teams: [],
        unassignedPlayers: [],
      },
    ];

    expect(getUniqueIterationName('Playoff Draft', iterations, 'manual-1')).toBe('Playoff Draft 2');
    expect(getUniqueIterationName('   ', iterations, 'manual-1')).toBe('Untitled Draft');
  });

  it('copies iterations safely when older tabs are missing teams arrays', () => {
    const sourceIteration: TeamIteration = {
      id: 'manual-1',
      name: 'Manual 1',
      type: 'manual',
      status: 'ready',
      createdAt: '2026-03-18T00:00:00.000Z',
      teams: [],
      unassignedPlayers: [],
    };

    const olderBrokenIteration = {
      id: 'legacy-tab',
      name: 'Legacy AI',
      type: 'ai',
      status: 'ready',
      createdAt: '2026-03-18T00:00:00.000Z',
      unassignedPlayers: [],
    } as TeamIteration;

    const result = createCopiedTeamIteration(sourceIteration, [sourceIteration, olderBrokenIteration]);

    expect(result.name).toBe('Manual 1 Copy');
    expect(result.teams).toEqual([]);
  });

  it('repairs ready iterations that lost both teams and player pool data', () => {
    const players = [
      {
        id: 'p1',
        name: 'Alex',
        gender: 'M',
        skillRating: 7,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
      {
        id: 'p2',
        name: 'Blair',
        gender: 'F',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
    ];

    const brokenIteration = {
      id: 'manual-broken',
      name: 'Manual 1',
      type: 'manual',
      status: 'ready',
      createdAt: '2026-03-18T00:00:00.000Z',
      teams: [],
      unassignedPlayers: [],
    } as TeamIteration;

    const state = {
      players,
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: {
        ...getDefaultConfig(),
        maxTeamSize: 2,
        targetTeams: 1,
      },
      teamIterations: [brokenIteration],
      activeTeamIterationId: brokenIteration.id,
    } satisfies Pick<
      AppState,
      'players' | 'teams' | 'unassignedPlayers' | 'stats' | 'playerGroups' | 'config' | 'teamIterations' | 'activeTeamIterationId'
    >;

    const result = ensureTeamIterations(state);

    expect(result.teamIterations[0]?.teams).toHaveLength(1);
    expect(result.teamIterations[0]?.unassignedPlayers).toHaveLength(2);
    expect(result.teamIterations[0]?.errorMessage).toBe('This tab was repaired from incomplete saved data.');
  });

  it('recomputes stale ready-iteration stats from the actual saved assignments', () => {
    const players = [
      {
        id: 'carly',
        name: 'Carly Munce',
        gender: 'F',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: ['Thomas Black'],
        avoidRequests: [],
      },
      {
        id: 'thomas-black',
        name: 'Thomas Black',
        gender: 'M',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
      {
        id: 'thomas-barnes',
        name: 'Thomas Barnes',
        gender: 'M',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
    ];

    const readyIteration: TeamIteration = {
      id: 'reviewed-draft-1',
      name: 'Reviewed Draft 1',
      type: 'manual',
      status: 'ready',
      createdAt: '2026-04-17T00:00:00.000Z',
      teams: [
        {
          id: 'team-1',
          name: 'Group A Comets',
          players: [players[0]!, players[1]!],
          averageSkill: 0,
          genderBreakdown: { M: 0, F: 0, Other: 0 },
          handlerCount: 0,
        },
        {
          id: 'team-2',
          name: 'Group B Blaze',
          players: [players[2]!],
          averageSkill: 0,
          genderBreakdown: { M: 0, F: 0, Other: 0 },
          handlerCount: 0,
        },
      ],
      unassignedPlayers: [],
      stats: {
        totalPlayers: 3,
        assignedPlayers: 3,
        unassignedPlayers: 0,
        mutualRequestsHonored: 0,
        mutualRequestsBroken: 0,
        mustHaveRequestsHonored: 0,
        mustHaveRequestsBroken: 1,
        niceToHaveRequestsHonored: 0,
        niceToHaveRequestsBroken: 0,
        avoidRequestsViolated: 0,
        conflictsDetected: 0,
        generationTime: 123,
      },
    };

    const result = ensureTeamIterations({
      players,
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: {
        ...getDefaultConfig(),
        targetTeams: 2,
        maxTeamSize: 2,
      },
      teamIterations: [readyIteration],
      activeTeamIterationId: readyIteration.id,
    });

    expect(result.teamIterations[0]?.stats?.mustHaveRequestsHonored).toBe(1);
    expect(result.teamIterations[0]?.stats?.mustHaveRequestsBroken).toBe(0);
  });

  it('deletes the active tab and switches to the next remaining tab', () => {
    const state = {
      players: [],
      teams: [{ id: 'team-a', name: 'Alpha', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: getDefaultConfig(),
      execRatingHistory: {},
      savedConfigs: [],
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-21T00:00:00.000Z',
          teams: [{ id: 'team-a', name: 'Alpha', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
          unassignedPlayers: [],
        },
        {
          id: 'manual-2',
          name: 'Manual 2',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-21T00:00:00.000Z',
          teams: [{ id: 'team-b', name: 'Bravo', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
          unassignedPlayers: [],
        },
      ],
      activeTeamIterationId: 'manual-1',
      leagueMemory: [],
    } satisfies AppState;

    const result = deleteTeamIterationFromState(state, 'manual-1');

    expect(result.teamIterations?.map(iteration => iteration.id)).toEqual(['manual-2']);
    expect(result.activeTeamIterationId).toBe('manual-2');
    expect(result.teams[0]?.name).toBe('Bravo');
  });

  it('deletes an inactive tab without disturbing the current active tab', () => {
    const state = {
      players: [],
      teams: [{ id: 'team-b', name: 'Bravo', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: getDefaultConfig(),
      execRatingHistory: {},
      savedConfigs: [],
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-21T00:00:00.000Z',
          teams: [{ id: 'team-a', name: 'Alpha', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
          unassignedPlayers: [],
        },
        {
          id: 'manual-2',
          name: 'Manual 2',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-21T00:00:00.000Z',
          teams: [{ id: 'team-b', name: 'Bravo', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
          unassignedPlayers: [],
        },
      ],
      activeTeamIterationId: 'manual-2',
      leagueMemory: [],
    } satisfies AppState;

    const result = deleteTeamIterationFromState(state, 'manual-1');

    expect(result.teamIterations?.map(iteration => iteration.id)).toEqual(['manual-2']);
    expect(result.activeTeamIterationId).toBe('manual-2');
    expect(result.teams[0]?.name).toBe('Bravo');
  });

  it('clears the workspace when the last tab is deleted', () => {
    const state = {
      players: [],
      teams: [{ id: 'team-a', name: 'Alpha', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
      unassignedPlayers: [],
      stats: {
        totalPlayers: 0,
        assignedPlayers: 0,
        unassignedPlayers: 0,
        mutualRequestsHonored: 0,
        mutualRequestsBroken: 0,
        mustHaveRequestsHonored: 0,
        mustHaveRequestsBroken: 0,
        niceToHaveRequestsHonored: 0,
        niceToHaveRequestsBroken: 0,
        avoidRequestsViolated: 0,
        conflictsDetected: 0,
        generationTime: 0,
      },
      playerGroups: [],
      config: getDefaultConfig(),
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-21T00:00:00.000Z',
          teams: [{ id: 'team-a', name: 'Alpha', players: [], averageSkill: 0, genderBreakdown: { M: 0, F: 0, Other: 0 } }],
          unassignedPlayers: [],
          stats: {
            totalPlayers: 0,
            assignedPlayers: 0,
            unassignedPlayers: 0,
            mutualRequestsHonored: 0,
            mutualRequestsBroken: 0,
            mustHaveRequestsHonored: 0,
            mustHaveRequestsBroken: 0,
            niceToHaveRequestsHonored: 0,
            niceToHaveRequestsBroken: 0,
            avoidRequestsViolated: 0,
            conflictsDetected: 0,
            generationTime: 0,
          },
        },
      ],
      activeTeamIterationId: 'manual-1',
      leagueMemory: [],
      execRatingHistory: {},
      savedConfigs: [],
    } satisfies AppState;

    const result = deleteTeamIterationFromState(state, 'manual-1');

    expect(result.teamIterations).toEqual([]);
    expect(result.activeTeamIterationId).toBeNull();
    expect(result.teams).toEqual([]);
    expect(result.unassignedPlayers).toEqual([]);
    expect(result.stats).toBeUndefined();
  });
});
