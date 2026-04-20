import { describe, expect, it } from 'vitest';

import { getPlayerAgeBand, isHighlightedPlayerAgeBand } from '@/utils/playerAgeBands';

describe('playerAgeBands', () => {
  it('classifies players under 22 as young', () => {
    expect(getPlayerAgeBand(21)).toBe('young');
    expect(getPlayerAgeBand(0)).toBe('young');
  });

  it('classifies players over 43 as wise', () => {
    expect(getPlayerAgeBand(44)).toBe('wise');
    expect(getPlayerAgeBand(60)).toBe('wise');
  });

  it('leaves players aged 22 to 43 as standard', () => {
    expect(getPlayerAgeBand(22)).toBe('standard');
    expect(getPlayerAgeBand(43)).toBe('standard');
  });

  it('marks missing ages separately and only highlights young or wise bands', () => {
    expect(getPlayerAgeBand(undefined)).toBe('missing');
    expect(isHighlightedPlayerAgeBand('young')).toBe(true);
    expect(isHighlightedPlayerAgeBand('wise')).toBe(true);
    expect(isHighlightedPlayerAgeBand('missing')).toBe(false);
    expect(isHighlightedPlayerAgeBand('standard')).toBe(false);
  });
});
