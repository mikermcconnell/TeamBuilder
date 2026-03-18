import { describe, expect, it } from 'vitest';

import type { AppState, TeamIteration } from '@/types';
import { getDefaultConfig } from '@/utils/configManager';
import { ensureTeamIterations } from '@/utils/teamIterations';

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
});
