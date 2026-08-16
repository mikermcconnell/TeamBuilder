import { drawWeightedSubWinners, getEligibleAvailableSubs } from './core.js';
import type {
  SubLotteryAvailability,
  SubLotteryAssignment,
  SubLotteryPlayer,
  SubLotteryPool,
  SubLotteryRequest,
} from './types.js';
import type { SubLotteryWorkflowDeadlines } from './workflow.js';
import { getWorkflowDeadlinesForGameDate } from './workflow.js';

interface CreateCaptainSubRequestInput {
  id: string;
  seasonId: string;
  captainName: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
  slotsNeeded?: number;
  gameDate?: string;
  now?: Date;
  deadlines?: SubLotteryWorkflowDeadlines;
}

interface MarkSubAvailabilityInput {
  existing: SubLotteryAvailability[];
  requestId: string;
  playerId: string;
  now?: Date;
  request?: SubLotteryRequest;
}

interface RunSubLotteryDrawInput {
  request: SubLotteryRequest;
  players: SubLotteryPlayer[];
  availability: SubLotteryAvailability[];
  now?: Date;
  random?: () => number;
}

type DrawResult =
  | { status: 'already-assigned'; request: SubLotteryRequest; players: SubLotteryPlayer[] }
  | { status: 'not-ready'; request: SubLotteryRequest; players: SubLotteryPlayer[] }
  | { status: 'no-eligible-subs'; request: SubLotteryRequest; players: SubLotteryPlayer[] }
  | { status: 'assigned'; request: SubLotteryRequest; players: SubLotteryPlayer[]; winners: SubLotteryPlayer[]; assignments: SubLotteryAssignment[] };

interface RunSubLotteryDrawCycleInput {
  requests: SubLotteryRequest[];
  players: SubLotteryPlayer[];
  availability: SubLotteryAvailability[];
  excludedPlayerIds?: string[];
  now?: Date;
  random?: () => number;
}

interface DrawCycleResult {
  requests: SubLotteryRequest[];
  players: SubLotteryPlayer[];
  assignments: SubLotteryAssignment[];
}

interface CancelCaptainSubRequestInput {
  request: SubLotteryRequest;
  now?: Date;
}

function sortRequestsForDraw(requests: SubLotteryRequest[]): SubLotteryRequest[] {
  return [...requests].sort((a, b) => (
    `${a.weekLabel ?? ''} ${a.gameLabel} ${a.openedAt} ${a.id}`
      .localeCompare(`${b.weekLabel ?? ''} ${b.gameLabel} ${b.openedAt} ${b.id}`)
  ));
}

export function createCaptainSubRequest({
  id,
  seasonId,
  captainName,
  teamName,
  gameLabel,
  pool,
  slotsNeeded = 1,
  gameDate,
  now = new Date(),
  deadlines,
}: CreateCaptainSubRequestInput): SubLotteryRequest {
  const openedAt = now.toISOString();
  const requestDeadlines = deadlines ?? (gameDate ? getWorkflowDeadlinesForGameDate(gameDate) : null);
  const availabilityOpensAt = requestDeadlines?.availabilityOpensAt ?? openedAt;
  const availabilityClosesAt = requestDeadlines?.availabilityClosesAt ?? openedAt;
  const drawAt = requestDeadlines?.drawAt ?? availabilityClosesAt;

  return {
    id,
    seasonId,
    captainName: captainName.trim(),
    teamName: teamName.trim(),
    gameLabel: gameLabel.trim(),
    pool,
    slotsNeeded: Math.max(1, Math.floor(slotsNeeded)),
    status: 'open',
    openedAt,
    closesAt: availabilityClosesAt,
    availabilityOpensAt,
    availabilityClosesAt,
    drawAt,
    assignedPlayerIds: [],
  };
}

export function markSubAvailability({
  existing,
  requestId,
  playerId,
  now = new Date(),
  request,
}: MarkSubAvailabilityInput): SubLotteryAvailability[] {
  if (request?.availabilityOpensAt && now.getTime() < new Date(request.availabilityOpensAt).getTime()) {
    throw new Error('Player entries are not open yet.');
  }
  if (request?.availabilityClosesAt && now.getTime() > new Date(request.availabilityClosesAt).getTime()) {
    throw new Error('Player entries are closed.');
  }

  const alreadyEntered = existing.some(entry => (
    entry.requestId === requestId && entry.playerId === playerId
  ));

  if (alreadyEntered) {
    return existing;
  }

  return [
    ...existing,
    {
      requestId,
      playerId,
      enteredAt: now.toISOString(),
    },
  ];
}

export function runSubLotteryDraw({
  request,
  players,
  availability,
  now = new Date(),
  random = Math.random,
}: RunSubLotteryDrawInput): DrawResult {
  if (request.status === 'assigned') {
    return { status: 'already-assigned', request, players };
  }

  const drawAt = request.drawAt ?? request.closesAt;
  if (now.getTime() < new Date(drawAt).getTime()) {
    return { status: 'not-ready', request, players };
  }

  const eligiblePlayers = getEligibleAvailableSubs({
    requestId: request.id,
    pool: request.pool,
    players,
    availability,
  });
  const winners = drawWeightedSubWinners(eligiblePlayers, request.slotsNeeded ?? 1, random);

  if (winners.length === 0) {
    return { status: 'no-eligible-subs', request, players };
  }

  const assignedAt = now.toISOString();
  const assignedPlayerIds = winners.map(winner => winner.id);
  const updatedRequest: SubLotteryRequest = {
    ...request,
    status: 'assigned',
    assignedPlayerId: assignedPlayerIds[0],
    assignedPlayerIds,
    assignedAt,
  };
  const updatedPlayers = players.map(player => (
    assignedPlayerIds.includes(player.id)
      ? { ...player, seasonSubCount: player.seasonSubCount + 1 }
      : player
  ));
  const assignments = winners.map(winner => ({
    requestId: request.id,
    seasonId: request.seasonId,
    playerId: winner.id,
    captainName: request.captainName,
    teamName: request.teamName,
    gameLabel: request.gameLabel,
    pool: request.pool,
    weekLabel: request.weekLabel,
    assignedAt,
    eligiblePlayerIds: eligiblePlayers.map(player => player.id),
  }));

  return {
    status: 'assigned',
    request: updatedRequest,
    players: updatedPlayers,
    winners: winners.map(winner => updatedPlayers.find(player => player.id === winner.id) ?? winner),
    assignments,
  };
}

export function cancelCaptainSubRequest({
  request,
  now = new Date(),
}: CancelCaptainSubRequestInput): SubLotteryRequest {
  if (request.status !== 'open') {
    throw new Error('Only open requests can be cancelled.');
  }

  const drawAt = request.drawAt ?? request.closesAt;
  if (now.getTime() >= new Date(drawAt).getTime()) {
    throw new Error('This draw already completed.');
  }

  return {
    ...request,
    status: 'void',
    cancelledAt: now.toISOString(),
  };
}

export function runSubLotteryDrawCycle({
  requests,
  players,
  availability,
  excludedPlayerIds = [],
  now = new Date(),
  random = Math.random,
}: RunSubLotteryDrawCycleInput): DrawCycleResult {
  const drawRequests = sortRequestsForDraw(requests.filter(request => request.status === 'open'));
  const requestIds = new Set(drawRequests.map(request => request.id));
  const updatedRequests = new Map(requests.map(request => [request.id, request]));
  const updatedPlayers = new Map(players.map(player => [player.id, { ...player }]));
  const assignments: SubLotteryAssignment[] = [];
  const winners = new Set<string>(excludedPlayerIds);
  const filledCounts = new Map(drawRequests.map(request => [request.id, 0]));
  const assignedAt = now.toISOString();

  const playerPreferences = new Map<string, SubLotteryAvailability[]>();
  availability
    .filter(entry => requestIds.has(entry.requestId))
    .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))
    .forEach(entry => {
      const entries = playerPreferences.get(entry.playerId) ?? [];
      entries.push(entry);
      playerPreferences.set(entry.playerId, entries);
    });

  const maxPreferenceCount = Math.max(0, ...Array.from(playerPreferences.values()).map(entries => entries.length));

  for (let preferenceIndex = 0; preferenceIndex < maxPreferenceCount; preferenceIndex += 1) {
    for (const request of drawRequests) {
      const drawAt = request.drawAt ?? request.closesAt;
      if (now.getTime() < new Date(drawAt).getTime()) {
        continue;
      }

      const slotsNeeded = request.slotsNeeded ?? 1;
      const filledCount = filledCounts.get(request.id) ?? 0;
      const remainingSlots = slotsNeeded - filledCount;
      if (remainingSlots <= 0) {
        continue;
      }

      const candidates = players.filter(player => {
        if (!player.active || player.pool !== request.pool || winners.has(player.id)) {
          return false;
        }
        const preference = playerPreferences.get(player.id)?.[preferenceIndex];
        return preference?.requestId === request.id;
      });

      const requestWinners = drawWeightedSubWinners(candidates, remainingSlots, random);
      if (requestWinners.length === 0) {
        continue;
      }

      const currentAssignedIds = updatedRequests.get(request.id)?.assignedPlayerIds ?? [];
      const assignedPlayerIds = [
        ...currentAssignedIds,
        ...requestWinners.map(winner => winner.id),
      ];

      requestWinners.forEach(winner => {
        winners.add(winner.id);
        const currentPlayer = updatedPlayers.get(winner.id);
        if (currentPlayer) {
          updatedPlayers.set(winner.id, {
            ...currentPlayer,
            seasonSubCount: currentPlayer.seasonSubCount + 1,
          });
        }
      });

      filledCounts.set(request.id, filledCount + requestWinners.length);
      updatedRequests.set(request.id, {
        ...updatedRequests.get(request.id)!,
        status: 'assigned',
        assignedPlayerId: assignedPlayerIds[0],
        assignedPlayerIds,
        assignedAt,
      });

      const eligiblePlayerIds = getEligibleAvailableSubs({
        requestId: request.id,
        pool: request.pool,
        players,
        availability,
      }).map(player => player.id);

      assignments.push(...requestWinners.map(winner => ({
        requestId: request.id,
        seasonId: request.seasonId,
        playerId: winner.id,
        captainName: request.captainName,
        teamName: request.teamName,
        gameLabel: request.gameLabel,
        pool: request.pool,
        weekLabel: request.weekLabel,
        assignedAt,
        eligiblePlayerIds,
      })));
    }
  }

  drawRequests.forEach(request => {
    const drawAt = request.drawAt ?? request.closesAt;
    if (now.getTime() >= new Date(drawAt).getTime()) {
      const currentRequest = updatedRequests.get(request.id)!;
      updatedRequests.set(request.id, {
        ...currentRequest,
        status: 'assigned',
        assignedPlayerId: currentRequest.assignedPlayerIds?.[0] ?? '',
        assignedPlayerIds: currentRequest.assignedPlayerIds ?? [],
        assignedAt: currentRequest.assignedAt ?? assignedAt,
      });
    }
  });

  return {
    requests: requests.map(request => updatedRequests.get(request.id) ?? request),
    players: players.map(player => updatedPlayers.get(player.id) ?? player),
    assignments,
  };
}
