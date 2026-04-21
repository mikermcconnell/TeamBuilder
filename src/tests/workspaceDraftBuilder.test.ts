import { describe, expect, it } from 'vitest';

import type { Player, SavedWorkspace, TeamIteration } from '@/types';
import { buildWorkspaceWithGeneratedDrafts } from '@/server/workspaces/workspaceDraftBuilder';
import { parseArgs } from '../../scripts/build-workspace-draft';

function createPlayer(
  id: string,
  name: string,
  gender: 'M' | 'F',
  skillRating: number,
  extras: Partial<Player> = {},
): Player {
  return {
    id,
    name,
    gender,
    skillRating,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...extras,
  };
}

function createWorkspace(): SavedWorkspace {
  const players = [
    createPlayer('p1', 'Alex', 'M', 9, { isHandler: true, isNewPlayer: false, profile: { age: 23 } }),
    createPlayer('p2', 'Blair', 'F', 8, { isHandler: false, isNewPlayer: true, profile: { age: 24 } }),
    createPlayer('p3', 'Casey', 'M', 7, { isHandler: true, isNewPlayer: false, profile: { age: 29 } }),
    createPlayer('p4', 'Drew', 'F', 6, { isHandler: false, isNewPlayer: true, profile: { age: 31 } }),
    createPlayer('p5', 'Evan', 'M', 5, { isHandler: false, isNewPlayer: false, profile: { age: 46 } }),
    createPlayer('p6', 'Finley', 'F', 4, { isHandler: true, isNewPlayer: true, profile: { age: 47 } }),
  ];

  return {
    id: 'workspace-1',
    userId: 'user-1',
    name: 'Spring league 2026 133',
    description: '',
    players,
    playerGroups: [
      {
        id: 'group-1',
        label: 'A',
        color: '#3B82F6',
        playerIds: ['p1', 'p2'],
        players: [players[0]!, players[1]!],
      },
    ],
    config: {
      id: 'league-1',
      name: 'Spring League',
      maxTeamSize: 4,
      minFemales: 1,
      minMales: 1,
      targetTeams: 2,
      allowMixedGender: true,
      restrictToEvenTeams: true,
    },
    teams: [
      {
        id: 'legacy-team-1',
        name: 'Legacy One',
        players: [players[0]!, players[1]!],
        averageSkill: 8.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
      {
        id: 'legacy-team-2',
        name: 'Legacy Two',
        players: [players[2]!, players[3]!],
        averageSkill: 6.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
    ],
    unassignedPlayers: [players[4]!, players[5]!],
    stats: {
      totalPlayers: 6,
      assignedPlayers: 4,
      unassignedPlayers: 2,
      mutualRequestsHonored: 0,
      mutualRequestsBroken: 0,
      mustHaveRequestsHonored: 0,
      mustHaveRequestsBroken: 0,
      niceToHaveRequestsHonored: 0,
      niceToHaveRequestsBroken: 0,
      avoidRequestsViolated: 0,
      conflictsDetected: 0,
      generationTime: 10,
    },
    execRatingHistory: {},
    savedConfigs: [],
    teamIterations: [],
    activeTeamIterationId: null,
    leagueMemory: [],
    pendingWarnings: [],
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    revision: 3,
    version: 1,
  };
}

function createGeneratedIteration(id: string, name: string, teams: TeamIteration['teams']): TeamIteration {
  const unassignedPlayers = teams.flatMap(team => team.players).length === 6 ? [] : [];

  return {
    id,
    name,
    type: 'ai',
    status: 'ready',
    generationSource: 'fallback',
    teams,
    unassignedPlayers,
    stats: {
      totalPlayers: 6,
      assignedPlayers: teams.flatMap(team => team.players).length,
      unassignedPlayers: unassignedPlayers.length,
      mutualRequestsHonored: 0,
      mutualRequestsBroken: 0,
      mustHaveRequestsHonored: 0,
      mustHaveRequestsBroken: 0,
      niceToHaveRequestsHonored: 0,
      niceToHaveRequestsBroken: 0,
      avoidRequestsViolated: 0,
      conflictsDetected: 0,
      generationTime: 12,
    },
    createdAt: '2026-04-21T00:00:00.000Z',
  };
}

describe('workspaceDraftBuilder', () => {
  it('appends a generated draft, preserves legacy team tabs, and supports odd team counts', async () => {
    const workspace = createWorkspace();
    const nextIteration = createGeneratedIteration('ai-1', 'AI 1', [
      {
        id: 'team-1',
        name: 'North Stars',
        players: [workspace.players[0]!, workspace.players[1]!],
        averageSkill: 8.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
      {
        id: 'team-2',
        name: 'River Foxes',
        players: [workspace.players[2]!, workspace.players[3]!],
        averageSkill: 6.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
      {
        id: 'team-3',
        name: 'Solar Wolves',
        players: [workspace.players[4]!, workspace.players[5]!],
        averageSkill: 4.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
    ]);

    const result = await buildWorkspaceWithGeneratedDrafts(
      workspace,
      {
        targetTeams: 3,
        now: '2026-04-21T12:00:00.000Z',
      },
      {
        createTeamIteration: async () => nextIteration,
      },
    );

    expect(result.generatedDrafts).toHaveLength(1);
    expect(result.workspace.teamIterations).toHaveLength(2);
    expect(result.workspace.teamIterations[0]?.name).toBe('Generated 1');
    expect(result.workspace.teamIterations[1]?.name).toBe('AI 1');
    expect(result.workspace.activeTeamIterationId).toBe('ai-1');
    expect(result.workspace.teams).toHaveLength(3);
    expect(result.workspace.config.targetTeams).toBe(3);
    expect(result.workspace.config.restrictToEvenTeams).toBe(false);
    expect(result.workspace.players.map(player => player.teamId)).toEqual(['team-1', 'team-1', 'team-2', 'team-2', 'team-3', 'team-3']);
    expect(result.workspace.playerGroups[0]?.players.map(player => player.id)).toEqual(['p1', 'p2']);
    expect(result.workspace.revision).toBe(4);
    expect(result.workspace.updatedAt).toBe('2026-04-21T12:00:00.000Z');
  });

  it('chooses the stronger draft as active when generating multiple candidates', async () => {
    const workspace = createWorkspace();
    const balancedDraft = createGeneratedIteration('ai-balanced', 'AI 1', [
      {
        id: 'team-a',
        name: 'Balanced A',
        players: [workspace.players[0]!, workspace.players[5]!],
        averageSkill: 6.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 2,
      },
      {
        id: 'team-b',
        name: 'Balanced B',
        players: [workspace.players[2]!, workspace.players[3]!],
        averageSkill: 6.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
      {
        id: 'team-c',
        name: 'Balanced C',
        players: [workspace.players[4]!, workspace.players[1]!],
        averageSkill: 6.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 0,
      },
    ]);
    const stackedDraft = createGeneratedIteration('ai-stacked', 'AI 2', [
      {
        id: 'team-x',
        name: 'Stacked X',
        players: [workspace.players[0]!, workspace.players[1]!],
        averageSkill: 8.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
      {
        id: 'team-y',
        name: 'Stacked Y',
        players: [workspace.players[2]!, workspace.players[3]!],
        averageSkill: 6.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
      {
        id: 'team-z',
        name: 'Stacked Z',
        players: [workspace.players[4]!, workspace.players[5]!],
        averageSkill: 4.5,
        genderBreakdown: { M: 1, F: 1, Other: 0 },
        handlerCount: 1,
      },
    ]);
    const drafts = [balancedDraft, stackedDraft];

    const result = await buildWorkspaceWithGeneratedDrafts(
      workspace,
      { draftCount: 2, targetTeams: 3 },
      {
        createTeamIteration: async ({ variant }) => (
          variant === 'primary' ? drafts[0]! : drafts[1]!
        ),
      },
    );

    expect(result.generatedDrafts).toHaveLength(2);
    expect(result.activeDraft.iteration.id).toBe('ai-balanced');
    expect(result.workspace.activeTeamIterationId).toBe('ai-balanced');
    expect(result.workspace.teams.map(team => team.id)).toEqual(['team-a', 'team-b', 'team-c']);
  });
});

describe('build-workspace-draft script', () => {
  it('parses write mode and workspace lookup options', () => {
    expect(parseArgs([
      '--workspace-name',
      'Spring league 2026 133',
      '--user-email',
      'bulequipment@gmail.com',
      '--target-teams',
      '3',
      '--draft-count',
      '2',
      '--write',
    ])).toEqual({
      'workspace-name': 'Spring league 2026 133',
      'user-email': 'bulequipment@gmail.com',
      'target-teams': '3',
      'draft-count': '2',
      write: true,
    });
  });
});
