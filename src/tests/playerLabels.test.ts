import { describe, expect, it } from 'vitest';
import { getPlayerLabels, normalizePlayerLabel } from '@/utils/playerLabels';
import type { Player } from '@/types';

function makePlayer(labels?: string[]): Player {
  return {
    id: 'player-1',
    name: 'Test Player',
    gender: 'F',
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    labels,
  };
}

describe('playerLabels', () => {
  it('normalizes labels', () => {
    expect(normalizePlayerLabel(' Heart Player ')).toBe('heart-player');
  });

  it('returns display metadata for known labels', () => {
    expect(getPlayerLabels(makePlayer(['heart', 'A♂', 'B♂', 'leader-a-male', 'leader-b-male']))).toEqual([
      expect.objectContaining({
        key: 'heart',
        shortLabel: '💜',
        label: 'Heart',
      }),
      expect.objectContaining({
        key: 'a♂',
        shortLabel: 'A♂',
        label: 'Leader A Male',
      }),
      expect.objectContaining({
        key: 'b♂',
        shortLabel: 'B♂',
        label: 'Leader B Male',
      }),
      expect.objectContaining({
        key: 'leader-a-male',
        shortLabel: 'A♂',
      }),
      expect.objectContaining({
        key: 'leader-b-male',
        shortLabel: 'B♂',
      }),
    ]);
  });

  it('deduplicates labels', () => {
    expect(getPlayerLabels(makePlayer(['heart', ' Heart ']))).toHaveLength(1);
  });
});
