import { describe, expect, it } from 'vitest';

import { validateLeagueConfig } from '@/utils/validation';

describe('validateLeagueConfig', () => {
  it('accepts the team-size and team-count values allowed by the UI', () => {
    const config = validateLeagueConfig({
      id: 'league-1',
      name: 'League',
      maxTeamSize: 50,
      maxAutoGroupSize: 50,
      minFemales: 25,
      minMales: 25,
      targetTeams: 1,
      allowMixedGender: true,
      restrictToEvenTeams: false,
    });

    expect(config.maxTeamSize).toBe(50);
    expect(config.maxAutoGroupSize).toBe(50);
    expect(config.minFemales).toBe(25);
    expect(config.minMales).toBe(25);
    expect(config.targetTeams).toBe(1);
  });

  it('accepts one-player team sizes saved from the UI', () => {
    const config = validateLeagueConfig({
      id: 'league-1',
      name: 'League',
      maxTeamSize: 1,
      minFemales: 0,
      minMales: 0,
      targetTeams: 1,
      allowMixedGender: true,
      restrictToEvenTeams: false,
    });

    expect(config.maxTeamSize).toBe(1);
    expect(config.targetTeams).toBe(1);
  });
});

