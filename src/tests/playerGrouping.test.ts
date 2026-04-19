import { describe, expect, it } from 'vitest';

import type { LeagueConfig, Player, PlayerGroup } from '@/types';
import { processMutualRequests, validateGroupsForGeneration } from '@/utils/playerGrouping';

function createPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'gender'>): Player {
  return {
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

describe('playerGrouping max request group size', () => {
  it('caps auto-created mutual request groups at the configured size', () => {
    const alex = createPlayer({
      id: 'alex',
      name: 'Alex',
      gender: 'M',
      teammateRequests: ['Blair', 'Casey'],
    });
    const blair = createPlayer({
      id: 'blair',
      name: 'Blair',
      gender: 'F',
      teammateRequests: ['Alex', 'Casey'],
    });
    const casey = createPlayer({
      id: 'casey',
      name: 'Casey',
      gender: 'Other',
      teammateRequests: ['Alex', 'Blair'],
    });

    const result = processMutualRequests([alex, blair, casey], { maxGroupSize: 2 });

    expect(result.playerGroups).toHaveLength(1);
    expect(result.playerGroups[0]?.players).toHaveLength(2);
    expect(result.playerGroups[0]?.source).toBe('auto');
    expect(result.nearMissGroups).toHaveLength(1);
    expect(result.nearMissGroups[0]).toMatchObject({
      reason: 'group-too-large',
      potentialSize: 3,
    });
  });

  it('warns but does not block manual groups above the auto cap', () => {
    const group: PlayerGroup = {
      id: 'group-manual',
      label: 'A',
      color: '#3B82F6',
      source: 'manual',
      playerIds: ['a', 'b', 'c', 'd'],
      players: [
        createPlayer({ id: 'a', name: 'A', gender: 'M' }),
        createPlayer({ id: 'b', name: 'B', gender: 'F' }),
        createPlayer({ id: 'c', name: 'C', gender: 'M' }),
        createPlayer({ id: 'd', name: 'D', gender: 'F' }),
      ],
    };

    const config: LeagueConfig = {
      id: 'league-1',
      name: 'League',
      maxTeamSize: 6,
      maxAutoGroupSize: 3,
      minFemales: 0,
      minMales: 0,
      allowMixedGender: true,
    };

    const validation = validateGroupsForGeneration([group], config);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toContain(
      'Group A has 4 players, which exceeds the auto request group cap of 3. This is still allowed because the group was created or edited manually.'
    );
  });
});
