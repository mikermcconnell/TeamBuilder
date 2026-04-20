import { describe, expect, it } from 'vitest';

import type { LeagueConfig, Player } from '@/types';
import { getConfiguredTeamCount, getRosterFeasibilityWarnings, validateConfig } from '@/utils/configManager';
import { normalizeLeagueConfig } from '@/utils/teamCount';

describe('configManager generation validation', () => {
  const baseConfig: LeagueConfig = {
    id: 'league-1',
    name: 'League',
    maxTeamSize: 5,
    minFemales: 0,
    minMales: 0,
    allowMixedGender: true,
  };

  it('uses the configured target team count when present', () => {
    expect(getConfiguredTeamCount(12, { ...baseConfig, targetTeams: 2 })).toBe(2);
    expect(getConfiguredTeamCount(12, baseConfig)).toBe(4);
  });

  it('allows odd team counts when the even-team restriction is turned off', () => {
    expect(getConfiguredTeamCount(12, { ...baseConfig, restrictToEvenTeams: false })).toBe(3);
  });

  it('preserves odd saved target team counts by disabling the even-team rule during normalization', () => {
    const normalizedConfig = normalizeLeagueConfig({
      ...baseConfig,
      targetTeams: 3,
      restrictToEvenTeams: true,
    });

    expect(normalizedConfig.targetTeams).toBe(3);
    expect(normalizedConfig.restrictToEvenTeams).toBe(false);
  });

  it('rejects team setups that cannot fit the whole roster', () => {
    const errors = validateConfig({ ...baseConfig, targetTeams: 2 }, 12);

    expect(errors).toContain('Current setup can only fit 10 players across 2 teams, but the roster has 12 players');
  });

  it('rejects mixed-gender minimums when mixed-gender teams are disabled', () => {
    const errors = validateConfig({
      ...baseConfig,
      allowMixedGender: false,
      minFemales: 1,
      minMales: 1,
    });

    expect(errors).toContain('Mixed gender teams are disabled, so you cannot require both male and female minimums on the same team');
  });

  it('warns when the roster cannot satisfy the configured female minimums without blocking generation', () => {
    const players: Player[] = [
      {
        id: 'm-1',
        name: 'Mark',
        gender: 'M',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
      {
        id: 'f-1',
        name: 'Fiona',
        gender: 'F',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
    ];

    const warnings = getRosterFeasibilityWarnings(players, {
      ...baseConfig,
      targetTeams: 2,
      minFemales: 1,
    });

    expect(warnings).toContain(
      'Current setup needs 2 female players across 2 teams, but the roster only has 1. Team generation will continue, but some teams may miss the female minimum.'
    );
  });
});
