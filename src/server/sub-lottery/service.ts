import { parseSubPlayerCsv, parseSubScheduleCsv } from '../../sub-lottery/core.js';
import { runSubLotteryDraw } from '../../sub-lottery/lifecycle.js';
import type { CreateSubRequestRequest } from '../../sub-lottery/apiContracts.js';
import type {
  SubLotteryAssignment,
  SubLotteryAvailability,
  SubLotteryPlayer,
  SubLotteryPublicState,
  SubLotteryRequest,
  SubLotteryScheduleEntry,
} from '../../sub-lottery/types.js';
import { getWorkflowDeadlinesForGameDate } from '../../sub-lottery/workflow.js';
import { getSubLotteryFirestore } from './firebaseAdmin.js';

const COLLECTIONS = {
  seasons: 'subLotterySeasons',
  players: 'subLotteryPlayers',
  requests: 'subLotteryRequests',
  availability: 'subLotteryAvailability',
  assignments: 'subLotteryAssignments',
  schedule: 'subLotterySchedule',
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
    scheduleEntries: [...state.scheduleEntries].sort((a, b) => (
      `${a.weekLabel} ${a.gameLabel} ${a.captainName}`.localeCompare(`${b.weekLabel} ${b.gameLabel} ${b.captainName}`)
    )),
    assignments: [...state.assignments].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt)),
  };
}

async function runReadyDraws(seasonId: string): Promise<void> {
  await runDueDrawsForSeason(seasonId);
}

export async function loadPublicSubLotteryState(seasonIdInput?: string): Promise<SubLotteryPublicState> {
  const seasonId = getSeasonId(seasonIdInput);
  await runReadyDraws(seasonId);

  const db = await getSubLotteryFirestore();
  const [seasonDoc, playersSnapshot, requestsSnapshot, availabilitySnapshot, scheduleSnapshot, assignmentsSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.seasons).doc(seasonId).get(),
    db.collection(COLLECTIONS.players).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.requests).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.availability).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.schedule).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.assignments).where('seasonId', '==', seasonId).get(),
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
    scheduleEntries: scheduleSnapshot.docs.map(doc => dataWithId<SubLotteryScheduleEntry>(doc)),
    assignments: assignmentsSnapshot.docs.map(doc => dataWithId<SubLotteryAssignment>(doc)),
  });
}

export async function createSubRequest(input: CreateSubRequestRequest): Promise<SubLotteryPublicState> {
  assertPinMatches(input.captainPin, 'SUB_LOTTERY_CAPTAIN_PIN');

  const seasonId = getSeasonId(input.seasonId);
  const db = await getSubLotteryFirestore();
  const scheduleDoc = await db.collection(COLLECTIONS.schedule).doc(input.scheduleEntryId).get();
  if (!scheduleDoc.exists) {
    throw new Error('Schedule entry not found.');
  }

  const scheduleEntry = dataWithId<SubLotteryScheduleEntry>(scheduleDoc);
  if (scheduleEntry.seasonId !== seasonId || !scheduleEntry.active) {
    throw new Error('Schedule entry is not active for this season.');
  }
  if (input.pool !== 'open' && input.pool !== 'female') {
    throw new Error('Choose open matching or female matching.');
  }
  const requestedSlots = Number(input.slotsNeeded);
  if (!Number.isFinite(requestedSlots) || requestedSlots < 1) {
    throw new Error('Choose how many subs are needed.');
  }
  const slotsNeeded = Math.floor(requestedSlots);
  if (!scheduleEntry.gameDate) {
    throw new Error('Schedule entry needs a game date.');
  }
  const deadlines = getWorkflowDeadlinesForGameDate(scheduleEntry.gameDate);
  if (Date.now() > new Date(deadlines.captainClosesAt).getTime()) {
    throw new Error('Captain requests are closed for this week.');
  }

  const existingRequest = await db
    .collection(COLLECTIONS.requests)
    .where('seasonId', '==', seasonId)
    .where('scheduleEntryId', '==', scheduleEntry.id)
    .where('pool', '==', input.pool)
    .where('status', '==', 'open')
    .limit(1)
    .get();

  if (!existingRequest.empty) {
    throw new Error('A sub need is already open for this scheduled game.');
  }

  const requestRef = db.collection(COLLECTIONS.requests).doc();
  const now = new Date().toISOString();
  const request: SubLotteryRequest = {
    id: requestRef.id,
    seasonId,
    captainName: scheduleEntry.captainName,
    teamName: scheduleEntry.teamName,
    gameLabel: scheduleEntry.gameLabel,
    pool: input.pool,
    slotsNeeded,
    status: 'open',
    openedAt: now,
    closesAt: deadlines.availabilityClosesAt,
    availabilityOpensAt: deadlines.availabilityOpensAt,
    availabilityClosesAt: deadlines.availabilityClosesAt,
    drawAt: deadlines.drawAt,
    assignedPlayerIds: [],
    scheduleEntryId: scheduleEntry.id,
    weekLabel: scheduleEntry.weekLabel,
  };

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
    const now = new Date();
    if (request.availabilityOpensAt && now.getTime() < new Date(request.availabilityOpensAt).getTime()) {
      throw new Error('Player entries are not open yet.');
    }
    if (request.availabilityClosesAt && now.getTime() > new Date(request.availabilityClosesAt).getTime()) {
      throw new Error('Player entries are closed.');
    }
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
  if (request.status !== 'open') {
    return;
  }
  const [playersSnapshot, availabilitySnapshot] = await Promise.all([
    db.collection(COLLECTIONS.players).where('seasonId', '==', request.seasonId).get(),
    db.collection(COLLECTIONS.availability).where('requestId', '==', request.id).get(),
  ]);
  const players = playersSnapshot.docs.map(doc => dataWithId<SubLotteryPlayer>(doc));
  const availability = availabilitySnapshot.docs.map(doc => dataWithId<SubLotteryAvailability>(doc));
  const draw = runSubLotteryDraw({
    request,
    players,
    availability,
    now,
  });

  if (draw.status === 'not-ready' || draw.status === 'already-assigned') {
    return;
  }

  await db.runTransaction(async transaction => {
    const latestRequest = await transaction.get(requestRef);
    if (!latestRequest.exists) throw new Error('Sub request not found.');
    const latestRequestData = dataWithId<SubLotteryRequest>(latestRequest);
    if (latestRequestData.status === 'assigned') return;

    const assignedAt = draw.status === 'assigned' ? draw.request.assignedAt : now.toISOString();
    const assignedPlayerIds = draw.status === 'assigned' ? draw.request.assignedPlayerIds ?? [] : [];

    transaction.update(requestRef, {
      status: 'assigned',
      assignedPlayerId: assignedPlayerIds[0] ?? '',
      assignedPlayerIds,
      assignedAt,
    });

    if (draw.status !== 'assigned') return;

    draw.winners.forEach(winner => {
      const winnerRef = db.collection(COLLECTIONS.players).doc(winner.id);
      transaction.update(winnerRef, {
        seasonSubCount: winner.seasonSubCount,
      });
    });

    draw.assignments.forEach(assignment => {
      const assignmentRef = db.collection(COLLECTIONS.assignments).doc(`${requestId}_${assignment.playerId}`);
      transaction.set(assignmentRef, assignment);
    });
  });
}

export async function runDueDrawsForSeason(seasonIdInput?: string, now = new Date()): Promise<void> {
  const seasonId = getSeasonId(seasonIdInput);
  const db = await getSubLotteryFirestore();
  const requestsSnapshot = await db
    .collection(COLLECTIONS.requests)
    .where('seasonId', '==', seasonId)
    .where('status', '==', 'open')
    .get();

  const dueRequests = requestsSnapshot.docs
    .map(doc => dataWithId<SubLotteryRequest>(doc))
    .filter(request => request.drawAt && new Date(request.drawAt).getTime() <= now.getTime());

  for (const request of dueRequests) {
    await runDrawForRequest(request.id, now);
  }
}

export async function runDueDrawsAndLoadState(seasonIdInput?: string): Promise<SubLotteryPublicState> {
  const seasonId = getSeasonId(seasonIdInput);
  await runDueDrawsForSeason(seasonId);
  return loadPublicSubLotteryState(seasonId);
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

export async function importSubSchedule(input: {
  seasonId?: string;
  seasonName: string;
  adminPin: string;
  csvText: string;
}): Promise<SubLotteryPublicState> {
  assertPinMatches(input.adminPin, 'SUB_LOTTERY_ADMIN_PIN');

  const seasonId = getSeasonId(input.seasonId);
  const scheduleEntries = parseSubScheduleCsv(input.csvText).map(entry => ({
    ...entry,
    seasonId,
  }));

  if (scheduleEntries.length === 0) {
    throw new Error('No valid schedule entries found. Use CSV headers: Week,Date,Captain,Team,Game Time,Pool.');
  }

  const db = await getSubLotteryFirestore();
  const existingSchedule = await db.collection(COLLECTIONS.schedule).where('seasonId', '==', seasonId).get();
  const batch = db.batch();
  const now = new Date().toISOString();

  batch.set(db.collection(COLLECTIONS.seasons).doc(seasonId), {
    id: seasonId,
    name: input.seasonName.trim() || 'Current season',
    updatedAt: now,
  }, { merge: true });

  existingSchedule.docs.forEach(doc => {
    batch.set(doc.ref, { active: false }, { merge: true });
  });

  scheduleEntries.forEach(entry => {
    batch.set(db.collection(COLLECTIONS.schedule).doc(entry.id), entry, { merge: true });
  });

  await batch.commit();
  return loadPublicSubLotteryState(seasonId);
}
