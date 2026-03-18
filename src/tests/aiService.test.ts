import { describe, expect, it } from 'vitest';

import type { LeagueConfig, Player, PlayerGroup } from '@/types';
import { parseAiTeamDraftResponse, validateAiTeamDraft } from '@/services/aiService';

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

const groups: PlayerGroup[] = [
  {
    id: 'g1',
    label: 'A',
    color: '#000',
    playerIds: ['p1', 'p2'],
    players: players.slice(0, 2),
  },
];

describe('AI full-team draft helpers', () => {
  it('parses a JSON response with fenced code blocks', () => {
    const payload = parseAiTeamDraftResponse(`\`\`\`json
{
  "summary": "Balanced teams",
  "teams": [
    { "slot": 1, "playerIds": ["p1", "p2"] },
    { "slot": 2, "playerIds": ["p3", "p4"] }
  ],
  "unassignedPlayerIds": []
}
\`\`\``);

    expect(payload).toEqual({
      summary: 'Balanced teams',
      teams: [
        { slot: 1, playerIds: ['p1', 'p2'] },
        { slot: 2, playerIds: ['p3', 'p4'] },
      ],
      unassignedPlayerIds: [],
    });
  });

  it('accepts a valid full-team draft', () => {
    const result = validateAiTeamDraft({
      summary: 'Balanced teams',
      teams: [
        { slot: 1, playerIds: ['p1', 'p2'] },
        { slot: 2, playerIds: ['p3', 'p4'] },
      ],
      unassignedPlayerIds: [],
    }, players, config, groups);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a draft that splits a player group', () => {
    const result = validateAiTeamDraft({
      teams: [
        { slot: 1, playerIds: ['p1', 'p3'] },
        { slot: 2, playerIds: ['p2', 'p4'] },
      ],
      unassignedPlayerIds: [],
    }, players, config, groups);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Group A was split across multiple destinations.');
  });
});
