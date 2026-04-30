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
    expect(getPlayerLabels(makePlayer(['heart']))).toEqual([
      expect.objectContaining({
        key: 'heart',
        shortLabel: '💜',
        label: 'Heart',
      }),
    ]);
  });

  it('deduplicates labels', () => {
    expect(getPlayerLabels(makePlayer(['heart', ' Heart ']))).toHaveLength(1);
  });
});

