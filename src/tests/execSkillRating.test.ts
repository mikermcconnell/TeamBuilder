import { describe, expect, it } from 'vitest';

import { buildTeamsFromDraft } from '@/shared/ai-draft';
import { getEffectiveSkillRating, type Player, type Team } from '@/types';
import { validatePlayer } from '@/utils/validation';

function createPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'gender'>): Player {
  return {
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

describe('execSkillRating behavior', () => {
  it('uses exec skill when present and falls back to skillRating when exec is null', () => {
    expect(getEffectiveSkillRating(createPlayer({
      id: 'p1',
      name: 'Exec Override',
      gender: 'M',
      skillRating: 5,
      execSkillRating: 8,
    }))).toBe(8);

    expect(getEffectiveSkillRating(createPlayer({
      id: 'p2',
      name: 'Base Skill',
      gender: 'F',
      skillRating: 7,
      execSkillRating: null,
    }))).toBe(7);
  });

  it('preserves an explicit null exec skill when validating player data', () => {
    const validated = validatePlayer({
      id: 'p1',
      name: 'Null Exec',
      gender: 'F',
      skillRating: 6,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
    });

    expect(validated?.execSkillRating).toBeNull();
  });

  it('uses effective skill ratings when building teams from an AI draft', () => {
    const players: Player[] = [
      createPlayer({
        id: 'p1',
        name: 'High Exec',
        gender: 'M',
        skillRating: 5,
        execSkillRating: 9,
      }),
      createPlayer({
        id: 'p2',
        name: 'Base Skill',
        gender: 'F',
        skillRating: 7,
        execSkillRating: null,
      }),
    ];

    const seedTeams: Team[] = [{
      id: 'team-1',
      name: 'Team 1',
      players: [],
      averageSkill: 0,
      genderBreakdown: { M: 0, F: 0, Other: 0 },
      handlerCount: 0,
    }];

    const built = buildTeamsFromDraft({
      teams: [{ slot: 1, playerIds: ['p1', 'p2'] }],
      unassignedPlayerIds: [],
    }, players, seedTeams);

    expect(built.unassignedPlayers).toEqual([]);
    expect(built.teams[0]?.averageSkill).toBe(8);
  });
});
