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
    expect(getPlayerLabels(makePlayer(['heart', 'leader-a-female', 'A♂', 'B♂', 'leader-a-male', 'leader-b-male', 'leader-b-female', 'leader-b']))).toEqual([
      expect.objectContaining({
        key: 'heart',
        shortLabel: 'A♀',
        label: 'Leader A Female',
      }),
      expect.objectContaining({
        key: 'leader-a-female',
        shortLabel: 'A♀',
        label: 'Leader A Female',
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
      expect.objectContaining({
        key: 'leader-b',
        shortLabel: 'B',
        label: 'Leader B',
      }),
    ]);
  });

  it('shows female Leader B only when female Leader A is absent', () => {
    expect(getPlayerLabels(makePlayer(['leader-b-female']))).toEqual([
      expect.objectContaining({
        key: 'leader-b-female',
        shortLabel: 'B♀',
        label: 'Leader B Female',
      }),
    ]);
  });

  it('deduplicates labels', () => {
    expect(getPlayerLabels(makePlayer(['heart', ' Heart ']))).toHaveLength(1);
  });
});
