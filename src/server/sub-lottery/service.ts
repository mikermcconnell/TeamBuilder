import { parseSubPlayerCsv } from '../../sub-lottery/core.js';
import { createCaptainSubRequest, runSubLotteryDraw } from '../../sub-lottery/lifecycle.js';
import type { CreateSubRequestRequest } from '../../sub-lottery/apiContracts.js';
import type {
  SubLotteryAvailability,
  SubLotteryPlayer,
  SubLotteryPublicState,
  SubLotteryRequest,
} from '../../sub-lottery/types.js';
import { getSubLotteryFirestore } from './firebaseAdmin.js';

const COLLECTIONS = {
  seasons: 'subLotterySeasons',
  players: 'subLotteryPlayers',
  requests: 'subLotteryRequests',
  availability: 'subLotteryAvailability',
  assignments: 'subLotteryAssignments',
} as const;

const DEFAULT_SEASON_ID = 'default-season';

function getSeasonId(seasonId?: string): string {
  return seasonId?.trim() || process.env.SUB_LOTTERY_SEASON_ID || DEFAULT_SEASON_ID;
}

function getRequiredSecret(envName: 'SUB_LOTTERY_CAPTAIN_PIN' | 'SUB_LOTTERY_ADMIN_PIN'): string {
  const value = process.env[envName];
  if (value?.trim()) {
    return value.trim();
  }

  if (process.env.NODE_ENV !== 'production') {
    return envName === 'SUB_LOTTERY_ADMIN_PIN' ? 'admin' : 'captain';
  }

  throw new Error(`${envName} is not configured.`);
}

function assertPinMatches(actual: string, expectedEnvName: 'SUB_LOTTERY_CAPTAIN_PIN' | 'SUB_LOTTERY_ADMIN_PIN') {
  if (actual.trim() !== getRequiredSecret(expectedEnvName)) {
    throw new Error('Invalid PIN.');
  }
}

function dataWithId<T>(doc: { id: string; data: () => FirebaseFirestore.DocumentData }): T {
  return { id: doc.id, ...doc.data() } as T;
}

function sortState(state: SubLotteryPublicState): SubLotteryPublicState {
  return {
    ...state,
    players: [...state.players].sort((a, b) => a.name.localeCompare(b.name)),
    requests: [...state.requests].sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    availability: [...state.availability].sort((a, b) => a.enteredAt.localeCompare(b.enteredAt)),
  };
}

async function runReadyDraws(seasonId: string): Promise<void> {
  const db = await getSubLotteryFirestore();
  const requestsSnapshot = await db
    .collection(COLLECTIONS.requests)
    .where('seasonId', '==', seasonId)
    .where('status', '==', 'open')
    .get();

  const now = new Date();
  const readyRequests = requestsSnapshot.docs
    .map(doc => dataWithId<SubLotteryRequest>(doc))
    .filter(request => new Date(request.closesAt).getTime() <= now.getTime());

  for (const request of readyRequests) {
    await runDrawForRequest(request.id, now);
  }
}

export async function loadPublicSubLotteryState(seasonIdInput?: string): Promise<SubLotteryPublicState> {
  const seasonId = getSeasonId(seasonIdInput);
  await runReadyDraws(seasonId);

  const db = await getSubLotteryFirestore();
  const [seasonDoc, playersSnapshot, requestsSnapshot, availabilitySnapshot] = await Promise.all([
    db.collection(COLLECTIONS.seasons).doc(seasonId).get(),
    db.collection(COLLECTIONS.players).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.requests).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.availability).where('seasonId', '==', seasonId).get(),
  ]);

  const seasonName = seasonDoc.exists && typeof seasonDoc.data()?.name === 'string'
    ? seasonDoc.data()?.name as string
    : 'Current season';

  return sortState({
    seasonId,
    seasonName,
    players: playersSnapshot.docs.map(doc => dataWithId<SubLotteryPlayer>(doc)),
    requests: requestsSnapshot.docs.map(doc => dataWithId<SubLotteryRequest>(doc)),
    availability: availabilitySnapshot.docs.map(doc => dataWithId<SubLotteryAvailability>(doc)),
  });
}

export async function createSubRequest(input: CreateSubRequestRequest): Promise<SubLotteryPublicState> {
  assertPinMatches(input.captainPin, 'SUB_LOTTERY_CAPTAIN_PIN');

  const seasonId = getSeasonId(input.seasonId);
  const db = await getSubLotteryFirestore();
  const requestRef = db.collection(COLLECTIONS.requests).doc();
  const request = createCaptainSubRequest({
    id: requestRef.id,
    seasonId,
    captainName: input.captainName,
    teamName: input.teamName,
    gameLabel: input.gameLabel,
    pool: input.pool,
  });

  if (!request.captainName || !request.teamName || !request.gameLabel) {
    throw new Error('Captain name, team name, and game time are required.');
  }

  await requestRef.set(request);
  return loadPublicSubLotteryState(seasonId);
}

export async function markPlayerAvailable(requestId: string, playerId: string): Promise<SubLotteryPublicState> {
  const db = await getSubLotteryFirestore();
  const requestRef = db.collection(COLLECTIONS.requests).doc(requestId);
  const playerRef = db.collection(COLLECTIONS.players).doc(playerId);
  const availabilityRef = db.collection(COLLECTIONS.availability).doc(`${requestId}_${playerId}`);
  let seasonId = getSeasonId();

  await db.runTransaction(async transaction => {
    const [requestDoc, playerDoc, availabilityDoc] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(playerRef),
      transaction.get(availabilityRef),
    ]);

    if (!requestDoc.exists) throw new Error('Sub request not found.');
    if (!playerDoc.exists) throw new Error('Player not found.');
    if (availabilityDoc.exists) return;

    const request = dataWithId<SubLotteryRequest>(requestDoc);
    const player = dataWithId<SubLotteryPlayer>(playerDoc);
    seasonId = request.seasonId;

    if (request.status !== 'open') throw new Error('This request is no longer open.');
    if (new Date(request.closesAt).getTime() <= Date.now()) throw new Error('This request window has closed.');
    if (!player.active || player.pool !== request.pool) throw new Error('This player is not eligible for this request.');

    transaction.set(availabilityRef, {
      requestId,
      playerId,
      seasonId: request.seasonId,
      enteredAt: new Date().toISOString(),
    });
  });

  return loadPublicSubLotteryState(seasonId);
}

export async function runDrawForRequest(requestId: string, now = new Date()): Promise<void> {
  const db = await getSubLotteryFirestore();
  const requestRef = db.collection(COLLECTIONS.requests).doc(requestId);
  const requestDoc = await requestRef.get();

  if (!requestDoc.exists) {
    throw new Error('Sub request not found.');
  }

  const request = dataWithId<SubLotteryRequest>(requestDoc);
  const [playersSnapshot, availabilitySnapshot] = await Promise.all([
    db.collection(COLLECTIONS.players).where('seasonId', '==', request.seasonId).get(),
    db.collection(COLLECTIONS.availability).where('requestId', '==', request.id).get(),
  ]);
  const players = playersSnapshot.docs.map(doc => dataWithId<SubLotteryPlayer>(doc));
  const availability = availabilitySnapshot.docs.map(doc => dataWithId<SubLotteryAvailability>(doc));
  const draw = runSubLotteryDraw({ request, players, availability, now });

  if (draw.status !== 'assigned') {
    return;
  }

  await db.runTransaction(async transaction => {
    const latestRequest = await transaction.get(requestRef);
    if (!latestRequest.exists) throw new Error('Sub request not found.');
    const latestRequestData = dataWithId<SubLotteryRequest>(latestRequest);
    if (latestRequestData.status === 'assigned') return;

    const winnerRef = db.collection(COLLECTIONS.players).doc(draw.winner.id);
    const assignmentRef = db.collection(COLLECTIONS.assignments).doc(requestId);

    transaction.update(requestRef, {
      status: 'assigned',
      assignedPlayerId: draw.winner.id,
      assignedAt: draw.request.assignedAt,
    });
    transaction.update(winnerRef, {
      seasonSubCount: draw.winner.seasonSubCount,
    });
    transaction.set(assignmentRef, {
      requestId,
      seasonId: request.seasonId,
      playerId: draw.winner.id,
      assignedAt: draw.request.assignedAt,
      eligiblePlayerIds: draw.players
        .filter(player => availability.some(entry => entry.requestId === request.id && entry.playerId === player.id))
        .map(player => player.id),
    });
  });
}

export async function runDrawAndLoadState(requestId: string): Promise<SubLotteryPublicState> {
  await runDrawForRequest(requestId);
  const db = await getSubLotteryFirestore();
  const requestDoc = await db.collection(COLLECTIONS.requests).doc(requestId).get();
  const request = requestDoc.exists ? dataWithId<SubLotteryRequest>(requestDoc) : null;
  return loadPublicSubLotteryState(request?.seasonId);
}

export async function importSubPlayers(input: {
  seasonId?: string;
  seasonName: string;
  adminPin: string;
  csvText: string;
}): Promise<SubLotteryPublicState> {
  assertPinMatches(input.adminPin, 'SUB_LOTTERY_ADMIN_PIN');

  const seasonId = getSeasonId(input.seasonId);
  const players = parseSubPlayerCsv(input.csvText).map(player => ({
    ...player,
    seasonId,
  }));

  if (players.length === 0) {
    throw new Error('No valid players found. Use CSV headers: Name,Pool.');
  }

  const db = await getSubLotteryFirestore();
  const existingPlayers = await db.collection(COLLECTIONS.players).where('seasonId', '==', seasonId).get();
  const batch = db.batch();
  const now = new Date().toISOString();

  batch.set(db.collection(COLLECTIONS.seasons).doc(seasonId), {
    id: seasonId,
    name: input.seasonName.trim() || 'Current season',
    updatedAt: now,
  }, { merge: true });

  existingPlayers.docs.forEach(doc => {
    batch.set(doc.ref, { active: false }, { merge: true });
  });

  players.forEach(player => {
    batch.set(db.collection(COLLECTIONS.players).doc(player.id), player, { merge: true });
  });

  await batch.commit();
  return loadPublicSubLotteryState(seasonId);
}

