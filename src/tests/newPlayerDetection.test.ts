import { describe, expect, it } from 'vitest';

import type { Player } from '@/types';
import { buildHistoricalPlayerLookup, flagNewPlayersFromHistory, getNewPlayerStatus, hasHistoricalPlayerMatch, toggleNewPlayerFlag } from '@/utils/newPlayerDetection';

describe('newPlayerDetection', () => {
  const historicalPlayers: Player[] = [
    {
      id: 'hist-1',
      name: 'Alex Smith',
      gender: 'M',
      skillRating: 7,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
      email: 'alex@example.com',
    },
    {
      id: 'hist-2',
      name: 'Jamie Lee',
      gender: 'F',
      skillRating: 6,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
    },
  ];

  it('matches players by email first and falls back to normalized name', () => {
    const lookup = buildHistoricalPlayerLookup([{ players: historicalPlayers }]);

    expect(hasHistoricalPlayerMatch({
      id: 'new-1',
      name: 'Someone Else',
      gender: 'M',
      skillRating: 5,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
      email: ' ALEX@example.com ',
    }, lookup)).toBe(true);

    expect(hasHistoricalPlayerMatch({
      id: 'new-2',
      name: '  jamie   lee ',
      gender: 'F',
      skillRating: 5,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
    }, lookup)).toBe(true);
  });

  it('flags only players without historical matches unless a manual flag already exists', () => {
    const players: Player[] = [
      {
        id: 'player-1',
        name: 'Alex Smith',
        gender: 'M',
        skillRating: 5,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
      {
        id: 'player-2',
        name: 'Brand New',
        gender: 'F',
        skillRating: 5,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      },
      {
        id: 'player-3',
        name: 'Manual Override',
        gender: 'Other',
        skillRating: 5,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
        isNewPlayer: false,
      },
    ];

    expect(flagNewPlayersFromHistory(players, [{ players: historicalPlayers }])).toMatchObject([
      { id: 'player-1', isNewPlayer: false },
      { id: 'player-2', isNewPlayer: true },
      { id: 'player-3', isNewPlayer: false },
    ]);
  });

  it('supports neutral status and toggle behavior for manual review', () => {
    expect(getNewPlayerStatus({ isNewPlayer: undefined })).toBe('unreviewed');
    expect(getNewPlayerStatus({ isNewPlayer: true })).toBe('new');
    expect(getNewPlayerStatus({ isNewPlayer: false })).toBe('returning');

    expect(toggleNewPlayerFlag(undefined)).toBe(true);
    expect(toggleNewPlayerFlag(true)).toBe(false);
    expect(toggleNewPlayerFlag(false)).toBe(true);
  });
});
