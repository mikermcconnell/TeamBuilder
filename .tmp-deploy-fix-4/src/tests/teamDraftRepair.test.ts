import { describe, expect, it } from 'vitest';

import type { AITeamDraftPayload } from '@/shared/ai-contracts';
import { validateAiTeamDraft } from '@/shared/ai-draft';
import { repairAiDraftGenderRequirements } from '@/server/ai/teamDraftRepair';
import type { LeagueConfig, Player, PlayerGroup } from '@/types';

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 2,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
  targetTeams: 2,
};

const players: Player[] = [
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
  {
    id: 'p3',
    name: 'Casey',
    gender: 'M',
    skillRating: 8,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
  },
  {
    id: 'p4',
    name: 'Drew',
    gender: 'F',
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
  },
];

describe('repairAiDraftGenderRequirements', () => {
  it('repairs a draft that only misses gender minimums', () => {
    const draft: AITeamDraftPayload = {
      summary: 'AI chose an imbalanced split.',
      teams: [
        { slot: 1, playerIds: ['p1', 'p3'] },
        { slot: 2, playerIds: ['p2', 'p4'] },
      ],
      unassignedPlayerIds: [],
    };

    const repaired = repairAiDraftGenderRequirements(draft, players, config, []);

    expect(repaired.repaired).toBe(true);
    expect(repaired.notes.length).toBeGreaterThan(0);

    const validation = validateAiTeamDraft(repaired.draft, players, config, []);
    expect(validation.valid).toBe(true);
    expect(repaired.draft.summary).toContain('repaired the AI draft');
  });

  it('does not try to repair a draft with non-gender structural errors', () => {
    const draft: AITeamDraftPayload = {
      summary: 'AI split a locked group.',
      teams: [
        { slot: 1, playerIds: ['p1', 'p3'] },
        { slot: 2, playerIds: ['p2', 'p4'] },
      ],
      unassignedPlayerIds: [],
    };

    const groups: PlayerGroup[] = [
      {
        id: 'g1',
        label: 'A',
        color: '#000',
        playerIds: ['p1', 'p2'],
        players: players.slice(0, 2),
      },
    ];

    const repaired = repairAiDraftGenderRequirements(draft, players, config, groups);

    expect(repaired.repaired).toBe(false);
    expect(repaired.notes).toEqual([]);
    expect(repaired.draft).toEqual(draft);
  });
});
