import type {
  SubLotteryAvailability,
  SubLotteryEntry,
  SubLotteryPlayer,
  SubLotteryPool,
  SubLotteryScheduleEntry,
} from './types.js';
import { getSubLotteryCoins } from './workflow.js';
import Papa from 'papaparse';

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

function uniqueSlug(baseValue: string, seenSlugs: Map<string, number>): string {
  const baseSlug = slugify(baseValue);
  const count = seenSlugs.get(baseSlug) ?? 0;
  seenSlugs.set(baseSlug, count + 1);
  return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
}

function parseCsvRows(csvText: string): string[][] {
  const parsed = Papa.parse<string[]>(csvText.trim(), {
    skipEmptyLines: 'greedy',
  });

  const fatalError = parsed.errors.find(error => error.code !== 'UndetectableDelimiter');
  if (fatalError) {
    throw new Error(fatalError.message);
  }

  return parsed.data
    .map(row => row.map(value => (value ?? '').trim()))
    .filter(row => row.some(value => value.length > 0));
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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getColumn(row: string[], headerIndexes: Map<string, number>, aliases: string[]): string {
  const index = aliases
    .map(alias => headerIndexes.get(normalizeHeader(alias)))
    .find((value): value is number => typeof value === 'number');

  return typeof index === 'number' ? (row[index] ?? '').trim() : '';
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function startOfLocalWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const daysSinceMonday = (day + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function endOfLocalWeek(date: Date): Date {
  const end = new Date(startOfLocalWeek(date));
  end.setDate(end.getDate() + 7);
  return end;
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
    weight: getSubLotteryCoins(player.seasonSubCount),
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

export function drawWeightedSubWinners(
  players: SubLotteryPlayer[],
  slotsNeeded: number,
  random: () => number = Math.random,
): SubLotteryPlayer[] {
  const winners: SubLotteryPlayer[] = [];
  const remainingPlayers = [...players];
  const slots = Math.max(0, Math.floor(slotsNeeded));

  while (winners.length < slots && remainingPlayers.length > 0) {
    const winner = drawWeightedSubWinner(remainingPlayers, random);
    if (!winner) break;
    winners.push(winner);
    const winnerIndex = remainingPlayers.findIndex(player => player.id === winner.id);
    if (winnerIndex >= 0) {
      remainingPlayers.splice(winnerIndex, 1);
    }
  }

  return winners;
}

export function parseSubPlayerCsv(csvText: string): SubLotteryPlayer[] {
  const rows = parseCsvRows(csvText);

  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0]!;
  const headerIndexes = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const seenSlugs = new Map<string, number>();

  return rows.slice(1).flatMap(row => {
    const name = getColumn(row, headerIndexes, ['Name', 'Player', 'Player Name']);
    const email = getColumn(row, headerIndexes, ['Email', 'Email Address']);
    const pool = normalizePool(getColumn(row, headerIndexes, ['Pool', 'Gender']));

    if (!name || !pool) {
      return [];
    }

    return [{
      id: uniqueSlug(name, seenSlugs),
      name,
      ...(email ? { email } : {}),
      pool,
      seasonSubCount: 0,
      active: true,
    }];
  });
}

export function parseSubScheduleCsv(csvText: string): SubLotteryScheduleEntry[] {
  const rows = parseCsvRows(csvText);

  if (rows.length <= 1) {
    return [];
  }

  const headers = rows[0]!;
  const headerIndexes = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const seenSlugs = new Map<string, number>();

  return rows.slice(1).flatMap(row => {
    const weekLabel = getColumn(row, headerIndexes, ['Week']);
    const gameDate = getColumn(row, headerIndexes, ['Date', 'Game Date']);
    const captainName = getColumn(row, headerIndexes, ['Captain', 'Captain Name']);
    const teamName = getColumn(row, headerIndexes, ['Team', 'Team Name']);
    const gameLabel = getColumn(row, headerIndexes, ['Game Time', 'Time', 'Game']);
    const pool = normalizePool(getColumn(row, headerIndexes, ['Pool', 'Gender'])) ?? 'open';

    if (!weekLabel || !captainName || !teamName || !gameLabel) {
      return [];
    }

    return [{
      id: uniqueSlug(`${weekLabel}-${gameDate ? `${gameDate}-` : ''}${captainName}-${teamName}-${gameLabel}`, seenSlugs),
      weekLabel,
      ...(gameDate ? { gameDate } : {}),
      captainName,
      teamName,
      gameLabel,
      pool,
      active: true,
    }];
  });
}

export function getCurrentScheduleWeekLabel(
  entries: SubLotteryScheduleEntry[],
  currentDate: Date = new Date(),
): string | null {
  const weekStart = startOfLocalWeek(currentDate);
  const weekEnd = endOfLocalWeek(currentDate);

  const currentWeekEntry = entries.find(entry => {
    if (!entry.active || !entry.gameDate) {
      return false;
    }

    const gameDate = parseDateOnly(entry.gameDate);
    return Boolean(gameDate && gameDate >= weekStart && gameDate < weekEnd);
  });

  return currentWeekEntry?.weekLabel ?? null;
}
