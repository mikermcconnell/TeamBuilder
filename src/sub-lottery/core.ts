import type {
  SubLotteryAvailability,
  SubLotteryEntry,
  SubLotteryPlayer,
  SubLotteryPool,
} from './types';

interface EligibleSubsInput {
  requestId: string;
  pool: SubLotteryPool;
  players: SubLotteryPlayer[];
  availability: SubLotteryAvailability[];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePool(value: string): SubLotteryPool | null {
  const normalized = value.trim().toLowerCase();
  if (['female', 'f', 'women', 'woman'].includes(normalized)) {
    return 'female';
  }
  if (['open', 'o', 'male', 'm'].includes(normalized)) {
    return 'open';
  }
  return null;
}

export function getEligibleAvailableSubs({
  requestId,
  pool,
  players,
  availability,
}: EligibleSubsInput): SubLotteryPlayer[] {
  const availablePlayerIds = new Set(
    availability
      .filter(entry => entry.requestId === requestId)
      .map(entry => entry.playerId)
  );

  return players.filter(player => (
    player.active
    && player.pool === pool
    && availablePlayerIds.has(player.id)
  ));
}

export function calculateLotteryEntries(players: SubLotteryPlayer[]): SubLotteryEntry[] {
  return players.map(player => ({
    playerId: player.id,
    weight: 1 / (1 + Math.max(0, player.seasonSubCount)),
  }));
}

export function drawWeightedSubWinner(
  players: SubLotteryPlayer[],
  random: () => number = Math.random,
): SubLotteryPlayer | null {
  if (players.length === 0) {
    return null;
  }

  const entries = calculateLotteryEntries(players);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = random() * totalWeight;

  for (const entry of entries) {
    threshold -= entry.weight;
    if (threshold <= 0) {
      return players.find(player => player.id === entry.playerId) ?? null;
    }
  }

  return players[players.length - 1] ?? null;
}

export function parseSubPlayerCsv(csvText: string): SubLotteryPlayer[] {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).flatMap(line => {
    const [rawName = '', rawPool = ''] = line.split(',').map(value => value.trim());
    const pool = normalizePool(rawPool);
    const name = rawName.trim();

    if (!name || !pool) {
      return [];
    }

    return [{
      id: slugify(name),
      name,
      pool,
      seasonSubCount: 0,
      active: true,
    }];
  });
}
