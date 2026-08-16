import { parseSubPlayerCsv, parseSubScheduleCsv } from '../../sub-lottery/core.js';
import { cancelCaptainSubRequest, runSubLotteryDrawCycle } from '../../sub-lottery/lifecycle.js';
import type { CreateSubRequestRequest } from '../../sub-lottery/apiContracts.js';
import type { DocumentData } from 'firebase-admin/firestore';
import type {
  SubLotteryAssignment,
  SubLotteryAvailability,
  SubLotteryPlayer,
  SubLotteryPublicState,
  SubLotteryRequest,
  SubLotteryScheduleEntry,
  SubLotteryWinnerEmailNotification,
} from '../../sub-lottery/types.js';
import { getWorkflowDeadlinesForGameDate } from '../../sub-lottery/workflow.js';
import { isWinnerEmailConfigured, sendWinnerEmail } from './email.js';
import { getSubLotteryFirestore } from './firebaseAdmin.js';

const COLLECTIONS = {
  seasons: 'subLotterySeasons',
  players: 'subLotteryPlayers',
  requests: 'subLotteryRequests',
  availability: 'subLotteryAvailability',
  assignments: 'subLotteryAssignments',
  schedule: 'subLotterySchedule',
  winnerEmails: 'subLotteryWinnerEmails',
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

function dataWithId<T>(doc: { id: string; data: () => DocumentData }): T {
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

function toPublicPlayer(player: SubLotteryPlayer): SubLotteryPlayer {
  const publicPlayer = { ...player };
  delete publicPlayer.email;
  return publicPlayer;
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
    players: playersSnapshot.docs.map(doc => toPublicPlayer(dataWithId<SubLotteryPlayer>(doc))),
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
  if (!Number.isInteger(requestedSlots) || requestedSlots < 1) {
    throw new Error('Choose a whole number of subs needed.');
  }
  const slotsNeeded = requestedSlots;
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

export async function cancelSubRequest(input: { requestId: string; captainPin: string }): Promise<SubLotteryPublicState> {
  assertPinMatches(input.captainPin, 'SUB_LOTTERY_CAPTAIN_PIN');

  const db = await getSubLotteryFirestore();
  const requestRef = db.collection(COLLECTIONS.requests).doc(input.requestId);
  let seasonId = getSeasonId();

  await db.runTransaction(async transaction => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists) {
      throw new Error('Sub request not found.');
    }

    const request = dataWithId<SubLotteryRequest>(requestDoc);
    seasonId = request.seasonId;
    const cancelledRequest = cancelCaptainSubRequest({ request });

    transaction.update(requestRef, {
      status: cancelledRequest.status,
      cancelledAt: cancelledRequest.cancelledAt,
    });
  });

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

  if (dueRequests.length === 0) {
    return;
  }

  const dueWeekLabels = new Set(dueRequests.map(request => request.weekLabel).filter(Boolean));
  const [playersSnapshot, availabilitySnapshot, assignmentsSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.players).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.availability).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.assignments).where('seasonId', '==', seasonId).get(),
  ]);

  const players = playersSnapshot.docs.map(doc => dataWithId<SubLotteryPlayer>(doc));
  const availability = availabilitySnapshot.docs.map(doc => dataWithId<SubLotteryAvailability>(doc));
  const existingAssignments = assignmentsSnapshot.docs.map(doc => dataWithId<SubLotteryAssignment>(doc));
  const excludedPlayerIds = existingAssignments
    .filter(assignment => assignment.weekLabel && dueWeekLabels.has(assignment.weekLabel))
    .map(assignment => assignment.playerId);
  const drawCycle = runSubLotteryDrawCycle({
    requests: dueRequests,
    players,
    availability,
    excludedPlayerIds,
    now,
  });

  await db.runTransaction(async transaction => {
    const updatedRequestIds = new Set<string>();
    const requestRefs = drawCycle.requests.map(request => db.collection(COLLECTIONS.requests).doc(request.id));
    const latestRequestDocs = await Promise.all(requestRefs.map(requestRef => transaction.get(requestRef)));

    for (const [index, request] of drawCycle.requests.entries()) {
      const requestRef = requestRefs[index]!;
      const latestRequest = latestRequestDocs[index]!;
      if (!latestRequest.exists) continue;
      const latestRequestData = dataWithId<SubLotteryRequest>(latestRequest);
      if (latestRequestData.status !== 'open') continue;

      transaction.update(requestRef, {
        status: request.status,
        assignedPlayerId: request.assignedPlayerIds?.[0] ?? '',
        assignedPlayerIds: request.assignedPlayerIds ?? [],
        assignedAt: request.assignedAt,
      });
      updatedRequestIds.add(request.id);
    }

    for (const player of drawCycle.players) {
      const originalPlayer = players.find(entry => entry.id === player.id);
      const playerHasCommittedAssignment = drawCycle.assignments.some(assignment => (
        assignment.playerId === player.id && updatedRequestIds.has(assignment.requestId)
      ));
      if (originalPlayer && playerHasCommittedAssignment && originalPlayer.seasonSubCount !== player.seasonSubCount) {
        transaction.update(db.collection(COLLECTIONS.players).doc(player.id), {
          seasonSubCount: player.seasonSubCount,
        });
      }
    }

    drawCycle.assignments.filter(assignment => updatedRequestIds.has(assignment.requestId)).forEach(assignment => {
      const assignmentRef = db.collection(COLLECTIONS.assignments).doc(`${assignment.requestId}_${assignment.playerId}`);
      transaction.set(assignmentRef, assignment);

      const assignedPlayer = players.find(player => player.id === assignment.playerId);
      const playerEmail = assignedPlayer?.email?.trim();
      if (playerEmail) {
        const notificationId = `${assignment.requestId}_${assignment.playerId}`;
        const notification: SubLotteryWinnerEmailNotification = {
          id: notificationId,
          seasonId: assignment.seasonId ?? seasonId,
          requestId: assignment.requestId,
          playerId: assignment.playerId,
          playerName: assignedPlayer.name,
          playerEmail,
          ...(assignment.teamName ? { teamName: assignment.teamName } : {}),
          ...(assignment.gameLabel ? { gameLabel: assignment.gameLabel } : {}),
          ...(assignment.weekLabel ? { weekLabel: assignment.weekLabel } : {}),
          ...(assignment.captainName ? { captainName: assignment.captainName } : {}),
          assignedAt: assignment.assignedAt,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          status: 'pending',
          attempts: 0,
        };
        transaction.create(db.collection(COLLECTIONS.winnerEmails).doc(notificationId), notification);
      }
    });
  });
}

async function claimWinnerEmail(notificationId: string): Promise<SubLotteryWinnerEmailNotification | null> {
  const db = await getSubLotteryFirestore();
  const notificationRef = db.collection(COLLECTIONS.winnerEmails).doc(notificationId);
  const now = new Date();

  return db.runTransaction(async transaction => {
    const notificationDoc = await transaction.get(notificationRef);
    if (!notificationDoc.exists) {
      return null;
    }

    const notification = dataWithId<SubLotteryWinnerEmailNotification>(notificationDoc);
    if (notification.status === 'sent' || notification.attempts >= 3) {
      return null;
    }

    if (notification.status === 'sending' && notification.updatedAt) {
      const sendingAgeMs = now.getTime() - new Date(notification.updatedAt).getTime();
      if (sendingAgeMs < 10 * 60 * 1000) {
        return null;
      }
    }

    const claimedNotification: SubLotteryWinnerEmailNotification = {
      ...notification,
      status: 'sending',
      attempts: notification.attempts + 1,
      updatedAt: now.toISOString(),
    };
    transaction.update(notificationRef, {
      status: claimedNotification.status,
      attempts: claimedNotification.attempts,
      updatedAt: claimedNotification.updatedAt,
    });
    return claimedNotification;
  });
}

export async function sendPendingWinnerEmailsForSeason(seasonIdInput?: string): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const seasonId = getSeasonId(seasonIdInput);
  if (!isWinnerEmailConfigured()) {
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const db = await getSubLotteryFirestore();
  const snapshot = await db.collection(COLLECTIONS.winnerEmails).where('seasonId', '==', seasonId).get();
  const notifications = snapshot.docs
    .map(doc => dataWithId<SubLotteryWinnerEmailNotification>(doc))
    .filter(notification => notification.status !== 'sent' && notification.attempts < 3);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of notifications) {
    const claimedNotification = await claimWinnerEmail(notification.id);
    if (!claimedNotification) {
      skipped += 1;
      continue;
    }

    try {
      const result = await sendWinnerEmail(claimedNotification);
      if (result.status === 'sent') {
        await db.collection(COLLECTIONS.winnerEmails).doc(notification.id).update({
          status: 'sent',
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastError: '',
        });
        sent += 1;
      } else {
        await db.collection(COLLECTIONS.winnerEmails).doc(notification.id).update({
          status: 'pending',
          lastError: result.message ?? 'Email skipped.',
          updatedAt: new Date().toISOString(),
        });
        skipped += 1;
      }
    } catch (error) {
      await db.collection(COLLECTIONS.winnerEmails).doc(notification.id).update({
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Email failed.',
        updatedAt: new Date().toISOString(),
      });
      failed += 1;
    }
  }

  return { sent, failed, skipped };
}

export async function runDueDrawsAndLoadState(seasonIdInput?: string): Promise<SubLotteryPublicState> {
  const seasonId = getSeasonId(seasonIdInput);
  await runDueDrawsForSeason(seasonId);
  return loadPublicSubLotteryState(seasonId);
}

export async function runDueDrawsSendWinnerEmailsAndLoadState(seasonIdInput?: string): Promise<{
  state: SubLotteryPublicState;
  emails: Awaited<ReturnType<typeof sendPendingWinnerEmailsForSeason>>;
}> {
  const seasonId = getSeasonId(seasonIdInput);
  await runDueDrawsForSeason(seasonId);
  const emails = await sendPendingWinnerEmailsForSeason(seasonId);
  const state = await loadPublicSubLotteryState(seasonId);
  return { state, emails };
}

export async function runDrawAndLoadState(requestId: string): Promise<SubLotteryPublicState> {
  const db = await getSubLotteryFirestore();
  const requestDoc = await db.collection(COLLECTIONS.requests).doc(requestId).get();
  const request = requestDoc.exists ? dataWithId<SubLotteryRequest>(requestDoc) : null;
  if (request) {
    await runDueDrawsForSeason(request.seasonId);
    await sendPendingWinnerEmailsForSeason(request.seasonId);
  }
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

  const duplicateNames = players
    .map(player => player.name.trim().toLowerCase())
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    throw new Error('Duplicate player names found. Please make each sub name unique before importing.');
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
    batch.set(db.collection(COLLECTIONS.players).doc(player.id), {
      ...player,
      email: player.email ?? '',
    }, { merge: true });
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
    throw new Error('No valid schedule entries found. Use CSV headers: Week,Date,Captain,Team,Game Time. Pool is optional.');
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
