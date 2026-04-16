import type { Player } from '@/types';

interface HistoricalRosterLike {
  players?: Player[];
}

interface HistoricalPlayerLookup {
  emails: Set<string>;
  names: Set<string>;
}

export type NewPlayerStatus = 'new' | 'returning' | 'unreviewed';

function normalizeName(name?: string): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeEmail(email?: string): string {
  return (email ?? '').trim().toLowerCase();
}

export function buildHistoricalPlayerLookup(rosters: HistoricalRosterLike[]): HistoricalPlayerLookup {
  const emails = new Set<string>();
  const names = new Set<string>();

  rosters.forEach(roster => {
    roster.players?.forEach(player => {
      const normalizedEmail = normalizeEmail(player.email);
      const normalizedName = normalizeName(player.name);

      if (normalizedEmail) {
        emails.add(normalizedEmail);
      }

      if (normalizedName) {
        names.add(normalizedName);
      }
    });
  });

  return { emails, names };
}

export function hasHistoricalPlayerMatch(
  player: Player,
  lookup: HistoricalPlayerLookup,
): boolean {
  const normalizedEmail = normalizeEmail(player.email);
  if (normalizedEmail && lookup.emails.has(normalizedEmail)) {
    return true;
  }

  const normalizedName = normalizeName(player.name);
  return normalizedName ? lookup.names.has(normalizedName) : false;
}

export function flagNewPlayersFromHistory<T extends HistoricalRosterLike>(
  players: Player[],
  historicalRosters: T[],
): Player[] {
  const lookup = buildHistoricalPlayerLookup(historicalRosters);

  return players.map(player => {
    if (typeof player.isNewPlayer === 'boolean') {
      return player;
    }

    return {
      ...player,
      isNewPlayer: !hasHistoricalPlayerMatch(player, lookup),
    };
  });
}

export function getNewPlayerStatus(player: Pick<Player, 'isNewPlayer'>): NewPlayerStatus {
  if (player.isNewPlayer === true) {
    return 'new';
  }

  if (player.isNewPlayer === false) {
    return 'returning';
  }

  return 'unreviewed';
}

export function toggleNewPlayerFlag(currentValue: boolean | undefined): boolean {
  if (currentValue === undefined) {
    return true;
  }

  return !currentValue;
}
