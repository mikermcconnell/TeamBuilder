import { drawWeightedSubWinners, getEligibleAvailableSubs } from './core';
import type {
  SubLotteryAvailability,
  SubLotteryAssignment,
  SubLotteryPlayer,
  SubLotteryPool,
  SubLotteryRequest,
} from './types';
import type { SubLotteryWorkflowDeadlines } from './workflow';
import { getWorkflowDeadlinesForGameDate } from './workflow';

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
