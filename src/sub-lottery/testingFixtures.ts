import type {
  SubLotteryAssignment,
  SubLotteryAvailability,
  SubLotteryPlayer,
  SubLotteryPublicState,
  SubLotteryRequest,
  SubLotteryScheduleEntry,
} from './types.js';
import { getWorkflowDeadlinesForWeekStart } from './workflow.js';

export type SubLotteryTestingPhase = 'captain' | 'player' | 'results';

export interface SubLotteryTestingFixture {
  currentDate: Date;
  state: SubLotteryPublicState;
}

export interface PersistedSubLotteryTestingFixture extends SubLotteryTestingFixture {
  weekStartDate: string;
}

const playerNames = [
  'Alice Green', 'Bella Blue', 'Cara Cloud', 'Dina Dash', 'Eva Elm',
  'Fiona Frost', 'Grace Gold', 'Harper Hill', 'Ivy Indigo', 'Jade Juniper',
  'Owen Orange', 'Sam Spruce', 'Noah Navy', 'Liam Lime', 'Jordan Jet',
  'Kai King', 'Mason Maple', 'Parker Pine', 'Quinn Quartz', 'Theo Tide',
];

const captainGames = [
  { captainName: 'Morgan Lee', captainEmail: 'morgan.lee@example.test', teamName: 'Blue Team', gameLabel: 'Wednesday 7:00 PM', dayOffset: 2, pool: 'open' as const, slotsNeeded: 2 },
  { captainName: 'Casey Smith', captainEmail: 'casey.smith@example.test', teamName: 'Green Team', gameLabel: 'Wednesday 8:30 PM', dayOffset: 2, pool: 'female' as const, slotsNeeded: 1 },
  { captainName: 'Taylor Brown', captainEmail: 'taylor.brown@example.test', teamName: 'Red Team', gameLabel: 'Thursday 7:00 PM', dayOffset: 3, pool: 'open' as const, slotsNeeded: 1 },
  { captainName: 'Riley Wilson', captainEmail: 'riley.wilson@example.test', teamName: 'Yellow Team', gameLabel: 'Thursday 8:30 PM', dayOffset: 3, pool: 'female' as const, slotsNeeded: 1 },
  { captainName: 'Jamie Chen', captainEmail: 'jamie.chen@example.test', teamName: 'Purple Team', gameLabel: 'Friday 8:00 PM', dayOffset: 4, pool: 'open' as const, slotsNeeded: 1 },
];

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateOnly(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getNextMonday(referenceDate: Date): Date {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const daysUntilMonday = (8 - date.getDay()) % 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return date;
}

function getPhaseDate(weekStart: Date, phase: SubLotteryTestingPhase): Date {
  const date = phase === 'captain' ? addDays(weekStart, -3) : new Date(weekStart);
  date.setHours(phase === 'player' ? 9 : phase === 'results' ? 13 : 12, 0, 0, 0);
  return date;
}

function parseDateOnly(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function buildPlayers(): SubLotteryPlayer[] {
  return playerNames.map((name, index) => ({
    id: `testing-player-${index + 1}`,
    name,
    email: `testing-player-${index + 1}@example.test`,
    pool: index < 10 ? 'female' : 'open',
    seasonSubCount: index % 5,
    active: true,
  }));
}

function buildSchedule(weekStart: Date): SubLotteryScheduleEntry[] {
  return captainGames.map((game, index) => ({
    id: `testing-game-${index + 1}`,
    seasonId: 'testing-season',
    weekLabel: 'Testing week',
    gameDate: formatDateOnly(addDays(weekStart, game.dayOffset)),
    captainName: game.captainName,
    captainEmail: game.captainEmail,
    teamName: game.teamName,
    gameLabel: game.gameLabel,
    pool: game.pool,
    active: true,
  }));
}

export function getSubLotteryTestingFixture(
  phase: SubLotteryTestingPhase,
  referenceDate = new Date(),
): SubLotteryTestingFixture {
  const weekStart = getNextMonday(referenceDate);
  const weekStartDate = formatDateOnly(weekStart);
  const deadlines = getWorkflowDeadlinesForWeekStart(weekStartDate);
  const players = buildPlayers();
  const scheduleEntries = buildSchedule(weekStart);
  const availability: SubLotteryAvailability[] = [];
  const assignments: SubLotteryAssignment[] = [];
  const selectedWinnerIds = new Set<string>();

  const requests: SubLotteryRequest[] = captainGames.map((game, requestIndex) => {
    const requestId = `testing-request-${requestIndex + 1}`;
    const eligiblePlayers = players.filter(player => player.pool === game.pool);
    const enteredPlayers = eligiblePlayers.slice(requestIndex % 3, (requestIndex % 3) + 5);

    if (phase === 'results') {
      enteredPlayers.forEach((player, entryIndex) => {
        availability.push({
          requestId,
          playerId: player.id,
          enteredAt: new Date(new Date(deadlines.availabilityOpensAt).getTime() + (entryIndex + 1) * 15 * 60_000).toISOString(),
        });
      });
    }

    const assignedPlayers = phase === 'results'
      ? enteredPlayers.filter(player => !selectedWinnerIds.has(player.id)).slice(0, game.slotsNeeded)
      : [];
    if (phase === 'results') {
      assignedPlayers.forEach(player => {
        selectedWinnerIds.add(player.id);
        assignments.push({
          requestId,
          playerId: player.id,
          seasonId: 'testing-season',
          captainName: game.captainName,
          teamName: game.teamName,
          gameLabel: game.gameLabel,
          pool: game.pool,
          weekLabel: 'Testing week',
          assignedAt: deadlines.drawAt,
          eligiblePlayerIds: enteredPlayers.map(entry => entry.id),
        });
      });
    }

    return {
      id: requestId,
      seasonId: 'testing-season',
      captainName: game.captainName,
      teamName: game.teamName,
      gameLabel: game.gameLabel,
      pool: game.pool,
      slotsNeeded: game.slotsNeeded,
      status: phase === 'results' ? 'assigned' : 'open',
      openedAt: getPhaseDate(weekStart, 'captain').toISOString(),
      closesAt: deadlines.availabilityClosesAt,
      availabilityOpensAt: deadlines.availabilityOpensAt,
      availabilityClosesAt: deadlines.availabilityClosesAt,
      drawAt: deadlines.drawAt,
      assignedPlayerIds: assignedPlayers.map(player => player.id),
      ...(phase === 'results' ? { assignedAt: deadlines.drawAt } : {}),
      scheduleEntryId: scheduleEntries[requestIndex]!.id,
      weekLabel: 'Testing week',
    };
  });

  return {
    currentDate: getPhaseDate(weekStart, phase),
    state: {
      seasonId: 'testing-season',
      seasonName: 'Sub lottery testing',
      players,
      requests,
      availability,
      scheduleEntries,
      assignments,
    },
  };
}

export function getPersistedSubLotteryTestingFixture(
  phase: SubLotteryTestingPhase = 'player',
  referenceDate = new Date(),
): PersistedSubLotteryTestingFixture {
  const fixture = getSubLotteryTestingFixture(phase, referenceDate);
  const weekStartDate = formatDateOnly(getNextMonday(referenceDate));
  const seasonId = `testing-${weekStartDate}`;
  const playerIdMap = new Map(fixture.state.players.map(player => [player.id, `${seasonId}-${player.id}`]));
  const scheduleIdMap = new Map(fixture.state.scheduleEntries.map(entry => [entry.id, `${seasonId}-${entry.id}`]));
  const requestIdMap = new Map(fixture.state.requests.map(request => [request.id, `${seasonId}-${request.id}`]));

  return {
    currentDate: fixture.currentDate,
    weekStartDate,
    state: {
      seasonId,
      seasonName: `Testing week of ${weekStartDate}`,
      players: fixture.state.players.map(player => {
        const playerWithoutEmail = { ...player };
        delete playerWithoutEmail.email;
        return {
          ...playerWithoutEmail,
          id: playerIdMap.get(player.id)!,
        };
      }),
      scheduleEntries: fixture.state.scheduleEntries.map(entry => ({
        ...entry,
        id: scheduleIdMap.get(entry.id)!,
        seasonId,
        weekLabel: `Week of ${weekStartDate}`,
        weekStartDate,
      })),
      requests: fixture.state.requests.map(request => ({
        ...request,
        id: requestIdMap.get(request.id)!,
        seasonId,
        weekStartDate,
        ...(request.scheduleEntryId ? { scheduleEntryId: scheduleIdMap.get(request.scheduleEntryId)! } : {}),
        weekLabel: `Week of ${weekStartDate}`,
        ...(request.assignedPlayerId ? { assignedPlayerId: playerIdMap.get(request.assignedPlayerId)! } : {}),
        assignedPlayerIds: request.assignedPlayerIds?.map(playerId => playerIdMap.get(playerId)!),
      })),
      availability: fixture.state.availability.map(entry => ({
        ...entry,
        requestId: requestIdMap.get(entry.requestId)!,
        playerId: playerIdMap.get(entry.playerId)!,
      })),
      assignments: fixture.state.assignments.map(assignment => ({
        ...assignment,
        seasonId,
        requestId: requestIdMap.get(assignment.requestId)!,
        playerId: playerIdMap.get(assignment.playerId)!,
        weekLabel: `Week of ${weekStartDate}`,
        eligiblePlayerIds: assignment.eligiblePlayerIds.map(playerId => playerIdMap.get(playerId)!),
      })),
    },
  };
}

export function getTestingPhaseDateForState(
  state: SubLotteryPublicState,
  phase: SubLotteryTestingPhase,
): Date {
  const firstGameDate = state.scheduleEntries.find(entry => entry.gameDate)?.gameDate;
  if (!firstGameDate) return new Date();
  const firstGame = parseDateOnly(firstGameDate);
  const monday = addDays(firstGame, -((firstGame.getDay() + 6) % 7));
  return getPhaseDate(monday, phase);
}
