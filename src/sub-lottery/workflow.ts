import type { SubLotteryScheduleEntry } from './types';

export const SUB_LOTTERY_TIME_ZONE = 'America/Toronto';
export const STARTING_LOTTERY_COINS = 5;
export const MIN_LOTTERY_COINS = 1;

export type SubLotteryWorkflowPhase = 'captain' | 'player' | 'lottery' | 'results';

export interface SubLotteryWorkflowDeadlines {
  captainClosesAt: string;
  availabilityOpensAt: string;
  availabilityClosesAt: string;
  drawAt: string;
}

export interface SubLotteryWorkflowState extends SubLotteryWorkflowDeadlines {
  phase: SubLotteryWorkflowPhase;
  activeStepIndex: number;
  targetWeekStartDate: string;
  nextDeadlineAt?: string;
  nextDeadlineLabel: string;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function getZonedParts(date: Date, timeZone = SUB_LOTTERY_TIME_ZONE): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday ?? 'Mon'] ?? 1,
  };
}

function dateOnlyFromParts(parts: Pick<ZonedParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function addLocalDays(parts: Pick<ZonedParts, 'year' | 'month' | 'day'>, days: number): Pick<ZonedParts, 'year' | 'month' | 'day'> {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getMondayForLocalDate(parts: ZonedParts): Pick<ZonedParts, 'year' | 'month' | 'day'> {
  const daysSinceMonday = (parts.weekday + 6) % 7;
  return addLocalDays(parts, -daysSinceMonday);
}

function zonedDateTimeToUtc(
  parts: Pick<ZonedParts, 'year' | 'month' | 'day'> & Pick<ZonedParts, 'hour' | 'minute' | 'second'>,
  timeZone = SUB_LOTTERY_TIME_ZONE,
): Date {
  let timestamp = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  for (let index = 0; index < 4; index += 1) {
    const actual = getZonedParts(new Date(timestamp), timeZone);
    const desiredLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const actualLocal = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const delta = desiredLocal - actualLocal;
    if (delta === 0) break;
    timestamp += delta;
  }

  return new Date(timestamp);
}

export function getSubLotteryCoins(seasonSubCount: number): number {
  return Math.max(MIN_LOTTERY_COINS, STARTING_LOTTERY_COINS - Math.max(0, seasonSubCount));
}

export function getWorkflowDeadlinesForWeekStart(weekStartDate: string): SubLotteryWorkflowDeadlines {
  const [year = 0, month = 1, day = 1] = weekStartDate.split('-').map(Number);
  const weekStart = { year, month, day };
  const captainCloseDate = addLocalDays(weekStart, -1);

  return {
    captainClosesAt: zonedDateTimeToUtc({ ...captainCloseDate, hour: 23, minute: 59, second: 59 }).toISOString(),
    availabilityOpensAt: zonedDateTimeToUtc({ ...weekStart, hour: 0, minute: 0, second: 0 }).toISOString(),
    availabilityClosesAt: zonedDateTimeToUtc({ ...weekStart, hour: 11, minute: 59, second: 59 }).toISOString(),
    drawAt: zonedDateTimeToUtc({ ...weekStart, hour: 12, minute: 1, second: 0 }).toISOString(),
  };
}

export function getWorkflowDeadlinesForGameDate(gameDate: string): SubLotteryWorkflowDeadlines {
  const [year = 0, month = 1, day = 1] = gameDate.split('-').map(Number);
  const noon = zonedDateTimeToUtc({ year, month, day, hour: 12, minute: 0, second: 0 });
  const weekStart = getMondayForLocalDate(getZonedParts(noon));
  return getWorkflowDeadlinesForWeekStart(dateOnlyFromParts(weekStart));
}

export function getSubLotteryWorkflowState(currentDate: Date = new Date()): SubLotteryWorkflowState {
  const parts = getZonedParts(currentDate);
  const currentWeekStart = getMondayForLocalDate(parts);
  const secondsSinceMidnight = parts.hour * 3600 + parts.minute * 60 + parts.second;
  const mondayNoon = 12 * 3600;
  const mondayDraw = 12 * 3600 + 60;
  const isMonday = parts.weekday === 1;
  const targetWeekStart = isMonday
    ? currentWeekStart
    : addLocalDays(currentWeekStart, 7);
  const targetWeekStartDate = dateOnlyFromParts(targetWeekStart);
  const deadlines = getWorkflowDeadlinesForWeekStart(targetWeekStartDate);

  if (isMonday && secondsSinceMidnight < mondayNoon) {
    return {
      ...getWorkflowDeadlinesForWeekStart(dateOnlyFromParts(currentWeekStart)),
      phase: 'player',
      activeStepIndex: 1,
      targetWeekStartDate: dateOnlyFromParts(currentWeekStart),
      nextDeadlineAt: getWorkflowDeadlinesForWeekStart(dateOnlyFromParts(currentWeekStart)).availabilityClosesAt,
      nextDeadlineLabel: 'Sub player entries close',
    };
  }

  if (isMonday && secondsSinceMidnight < mondayDraw) {
    return {
      ...getWorkflowDeadlinesForWeekStart(dateOnlyFromParts(currentWeekStart)),
      phase: 'lottery',
      activeStepIndex: 2,
      targetWeekStartDate: dateOnlyFromParts(currentWeekStart),
      nextDeadlineAt: getWorkflowDeadlinesForWeekStart(dateOnlyFromParts(currentWeekStart)).drawAt,
      nextDeadlineLabel: 'Lottery runs',
    };
  }

  if (isMonday) {
    return {
      ...getWorkflowDeadlinesForWeekStart(dateOnlyFromParts(currentWeekStart)),
      phase: 'results',
      activeStepIndex: 3,
      targetWeekStartDate: dateOnlyFromParts(currentWeekStart),
      nextDeadlineLabel: 'Results are posted',
    };
  }

  return {
    ...deadlines,
    phase: 'captain',
    activeStepIndex: 0,
    targetWeekStartDate,
    nextDeadlineAt: deadlines.captainClosesAt,
    nextDeadlineLabel: 'Captain requests close',
  };
}

export function getWorkflowScheduleWeekLabel(
  entries: SubLotteryScheduleEntry[],
  currentDate: Date = new Date(),
): string | null {
  const workflow = getSubLotteryWorkflowState(currentDate);
  const weekEnd = addLocalDays({
    year: Number(workflow.targetWeekStartDate.slice(0, 4)),
    month: Number(workflow.targetWeekStartDate.slice(5, 7)),
    day: Number(workflow.targetWeekStartDate.slice(8, 10)),
  }, 7);
  const weekEndDate = dateOnlyFromParts(weekEnd);

  const entry = entries.find(scheduleEntry => (
    scheduleEntry.active
    && Boolean(scheduleEntry.gameDate)
    && scheduleEntry.gameDate! >= workflow.targetWeekStartDate
    && scheduleEntry.gameDate! < weekEndDate
  ));

  return entry?.weekLabel ?? null;
}

export function formatCountdown(targetIso: string | undefined, currentDate: Date = new Date()): string {
  if (!targetIso) return 'No deadline';
  const diffMs = new Date(targetIso).getTime() - currentDate.getTime();
  if (diffMs <= 0) return 'Now';

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
