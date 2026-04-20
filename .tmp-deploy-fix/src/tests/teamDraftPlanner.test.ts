import { describe, expect, it } from 'vitest';

import type { AITeamDraftPayload } from '@/shared/ai-contracts';
import { applyTeamDraftPlan, type TeamDraftCandidate } from '@/server/ai/teamDraftPlanner';
import type { LeagueConfig, PlayerGroup } from '@/types';

const players = [
  { id: 'p1', name: 'Alice', gender: 'F', skillRating: 8, execSkillRating: null, teammateRequests: [], avoidRequests: [], isHandler: false },
  { id: 'p2', name: 'Beth', gender: 'F', skillRating: 7, execSkillRating: null, teammateRequests: [], avoidRequests: [], isHandler: false },
  { id: 'p3', name: 'Cara', gender: 'F', skillRating: 6, execSkillRating: null, teammateRequests: [], avoidRequests: [], isHandler: false },
  { id: 'p4', name: 'Dana', gender: 'F', skillRating: 5, execSkillRating: null, teammateRequests: [], avoidRequests: [], isHandler: false },
];

const config: LeagueConfig = {
  id: 'config-1',
  name: 'Test Config',
  maxTeamSize: 2,
  minFemales: 2,
  minMales: 0,
  targetTeams: 2,
  allowMixedGender: true,
};

const baseDraft: AITeamDraftPayload = {
  teams: [
    { slot: 1, playerIds: ['p1', 'p2'] },
    { slot: 2, playerIds: ['p3', 'p4'] },
  ],
  unassignedPlayerIds: [],
};

const candidate: TeamDraftCandidate = {
  id: 'balanced-seed',
  label: 'Balanced seed',
  summary: 'Base valid draft',
  draft: baseDraft,
};

describe('applyTeamDraftPlan', () => {
  it('returns the selected candidate unchanged when there are no operations', () => {
    const result = applyTeamDraftPlan({
      plan: {
        summary: 'Use the balanced seed as-is.',
        selectedCandidateId: 'balanced-seed',
        operations: [],
      },
      candidates: [candidate],
      players: players.map(player => ({ ...player })),
      config,
      playerGroups: [],
    });

    expect(result.draft.source).toBe('ai');
    expect(result.draft.summary).toBe('Use the balanced seed as-is.');
    expect(result.appliedOperations).toHaveLength(0);
    expect(result.ignoredOperations).toHaveLength(0);
    expect(result.draft.teams).toEqual(baseDraft.teams);
  });

  it('applies a valid swap operation', () => {
    const result = applyTeamDraftPlan({
      plan: {
        summary: 'Swap one player from each team.',
        selectedCandidateId: 'balanced-seed',
        operations: [
          {
            type: 'swap',
            sourceId: 'team-1',
            targetId: 'team-2',
            playerIds: ['p2'],
            swapPlayerIds: ['p3'],
          },
        ],
      },
      candidates: [candidate],
      players: players.map(player => ({ ...player })),
      config,
      playerGroups: [],
    });

    expect(result.appliedOperations).toHaveLength(1);
    expect(result.ignoredOperations).toHaveLength(0);
    expect(result.draft.teams[0]?.playerIds).toEqual(['p1', 'p3']);
    expect(result.draft.teams[1]?.playerIds).toEqual(['p4', 'p2']);
  });

  it('ignores an operation that would split a locked player group', () => {
    const playerGroups: PlayerGroup[] = [
      {
        id: 'g1',
        label: 'Group A',
        color: '#000000',
        playerIds: ['p1', 'p2'],
        players: players.filter(player => ['p1', 'p2'].includes(player.id)).map(player => ({ ...player })),
      },
    ];

    const result = applyTeamDraftPlan({
      plan: {
        summary: 'Try a risky move.',
        selectedCandidateId: 'balanced-seed',
        operations: [
          {
            type: 'move',
            sourceId: 'team-1',
            targetId: 'team-2',
            playerIds: ['p2'],
          },
        ],
      },
      candidates: [candidate],
      players: players.map(player => ({ ...player })),
      config,
      playerGroups,
    });

    expect(result.appliedOperations).toHaveLength(0);
    expect(result.ignoredOperations).toHaveLength(1);
    expect(result.draft.teams).toEqual(baseDraft.teams);
  });
});
