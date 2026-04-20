import { WISE_PLAYER_MIN_AGE, YOUNG_PLAYER_MAX_AGE } from '@/config/constants';

export type PlayerAgeBand = 'young' | 'wise' | 'standard' | 'missing';
export type HighlightedPlayerAgeBand = 'young' | 'wise';
export type AgeFilterBand = HighlightedPlayerAgeBand | 'missing';

export function getPlayerAgeBand(age?: number | null): PlayerAgeBand {
  if (age === undefined || age === null) {
    return 'missing';
  }

  if (age <= YOUNG_PLAYER_MAX_AGE) {
    return 'young';
  }

  if (age >= WISE_PLAYER_MIN_AGE) {
    return 'wise';
  }

  return 'standard';
}

export function isHighlightedPlayerAgeBand(ageBand: PlayerAgeBand): ageBand is HighlightedPlayerAgeBand {
  return ageBand === 'young' || ageBand === 'wise';
}
