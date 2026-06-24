import { drawWeightedSubWinner, getEligibleAvailableSubs } from './core';
import type {
  SubLotteryAvailability,
  SubLotteryPlayer,
  SubLotteryPool,
  SubLotteryRequest,
} from './types';

interface CreateCaptainSubRequestInput {
  id: string;
  seasonId: string;
  captainName: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
  now?: Date;
}

interface MarkSubAvailabilityInput {
  existing: SubLotteryAvailability[];
  requestId: string;
  playerId: string;
  now?: Date;
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
  | { status: 'assigned'; request: SubLotteryRequest; players: SubLotteryPlayer[]; winner: SubLotteryPlayer };

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function createCaptainSubRequest({
  id,
  seasonId,
  captainName,
  teamName,
  gameLabel,
  pool,
  now = new Date(),
}: CreateCaptainSubRequestInput): SubLotteryRequest {
  const openedAt = now.toISOString();
  const closesAt = new Date(now.getTime() + TWO_HOURS_MS).toISOString();

  return {
    id,
    seasonId,
    captainName: captainName.trim(),
    teamName: teamName.trim(),
    gameLabel: gameLabel.trim(),
    pool,
    status: 'open',
    openedAt,
    closesAt,
  };
}

export function markSubAvailability({
  existing,
  requestId,
  playerId,
  now = new Date(),
}: MarkSubAvailabilityInput): SubLotteryAvailability[] {
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

  if (now.getTime() < new Date(request.closesAt).getTime()) {
    return { status: 'not-ready', request, players };
  }

  const eligiblePlayers = getEligibleAvailableSubs({
    requestId: request.id,
    pool: request.pool,
    players,
    availability,
  });
  const winner = drawWeightedSubWinner(eligiblePlayers, random);

  if (!winner) {
    return { status: 'no-eligible-subs', request, players };
  }

  const assignedAt = now.toISOString();
  const updatedRequest: SubLotteryRequest = {
    ...request,
    status: 'assigned',
    assignedPlayerId: winner.id,
    assignedAt,
  };
  const updatedPlayers = players.map(player => (
    player.id === winner.id
      ? { ...player, seasonSubCount: player.seasonSubCount + 1 }
      : player
  ));
  const updatedWinner = updatedPlayers.find(player => player.id === winner.id) ?? winner;

  return {
    status: 'assigned',
    request: updatedRequest,
    players: updatedPlayers,
    winner: updatedWinner,
  };
}
