import { createHash, randomBytes } from 'node:crypto';
import { calculateLotteryEntries, drawWeightedSubWinner, normalizeSubLotteryEmail, parseSubPlayerCsv, parseSubScheduleCsv } from '../../sub-lottery/core.js';
import { cancelCaptainSubRequest, runSubLotteryDrawCycle } from '../../sub-lottery/lifecycle.js';
import type { CreateSubRequestRequest } from '../../sub-lottery/apiContracts.js';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import type {
  SubLotteryAssignment,
  SubLotteryAvailability,
  SubLotteryPlayer,
  SubLotteryPublicState,
  SubLotteryRequest,
  SubLotteryScheduleEntry,
  SubLotteryWinnerEmailNotification,
  SubLotteryDrawRecord,
  SubLotteryPublicReceipt,
} from '../../sub-lottery/types.js';
import { getSubLotteryWorkflowState, getWeekStartDateForGameDate, getWorkflowDeadlinesForGameDate, getWorkflowDeadlinesForWeekStart } from '../../sub-lottery/workflow.js';
import { getPersistedSubLotteryTestingFixture } from '../../sub-lottery/testingFixtures.js';
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
  draws: 'subLotteryDraws',
  audit: 'subLotteryAudit',
} as const;

const DEFAULT_SEASON_ID = 'default-season';

function isTestingSeason(seasonId: string): boolean {
  return /^testing-\d{4}-\d{2}-\d{2}$/.test(seasonId);
}

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
  if (!isTestingSeason(seasonId)) {
    await runReadyDraws(seasonId);
  }

  const db = await getSubLotteryFirestore();
  const [seasonDoc, playersSnapshot, requestsSnapshot, availabilitySnapshot, scheduleSnapshot, assignmentsSnapshot, drawsSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.seasons).doc(seasonId).get(),
    db.collection(COLLECTIONS.players).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.requests).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.availability).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.schedule).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.assignments).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.draws).where('seasonId', '==', seasonId).get(),
  ]);

  const seasonName = seasonDoc.exists && typeof seasonDoc.data()?.name === 'string'
    ? seasonDoc.data()?.name as string
    : 'Current season';

  const storedWeek = seasonDoc.data()?.weekStartDate as string | undefined;
  const weekStartDate = isTestingSeason(seasonId) && storedWeek ? storedWeek : getSubLotteryWorkflowState().targetWeekStartDate;
  const requests = requestsSnapshot.docs.map(doc => dataWithId<SubLotteryRequest>(doc)).filter(request => !request.weekStartDate || request.weekStartDate === weekStartDate);
  const requestIds = new Set(requests.map(request => request.id));
  const receipts: SubLotteryPublicReceipt[] = drawsSnapshot.docs.map(doc => dataWithId<SubLotteryDrawRecord>(doc))
    .filter(draw => draw.weekStartDate === weekStartDate)
    .map(draw => ({ id: draw.id, requestId: draw.requestId, weekStartDate: draw.weekStartDate, algorithmVersion: draw.algorithmVersion, seedCommitment: draw.seedCommitment, seedReveal: draw.seedReveal, inputHash: draw.inputHash, createdAt: draw.createdAt }));
  return sortState({
    seasonId,
    seasonName,
    weekStartDate,
    players: playersSnapshot.docs.map(doc => toPublicPlayer(dataWithId<SubLotteryPlayer>(doc))),
    requests,
    availability: availabilitySnapshot.docs.map(doc => dataWithId<SubLotteryAvailability>(doc)).filter(entry => requestIds.has(entry.requestId)),
    scheduleEntries: scheduleSnapshot.docs.map(doc => dataWithId<SubLotteryScheduleEntry>(doc)).filter(entry => !entry.weekStartDate || entry.weekStartDate === weekStartDate),
    assignments: assignmentsSnapshot.docs.map(doc => dataWithId<SubLotteryAssignment>(doc)).filter(entry => !entry.weekStartDate || entry.weekStartDate === weekStartDate),
    receipts,
  });
}

export async function createSubRequest(input: CreateSubRequestRequest): Promise<SubLotteryPublicState> {
  const seasonId = getSeasonId(input.seasonId);
  if (!isTestingSeason(seasonId)) {
    assertPinMatches(input.captainPin, 'SUB_LOTTERY_CAPTAIN_PIN');
  }

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
  if (!isTestingSeason(seasonId) && Date.now() > new Date(deadlines.captainClosesAt).getTime()) {
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
    const existingRequestRef = existingRequest.docs[0]!.ref;
    await db.runTransaction(async transaction => {
      const latestRequestDoc = await transaction.get(existingRequestRef);
      if (!latestRequestDoc.exists) {
        throw new Error('The existing sub need could not be found. Please try again.');
      }
      const latestRequest = dataWithId<SubLotteryRequest>(latestRequestDoc);
      if (latestRequest.status !== 'open') {
        throw new Error('The existing sub need is no longer open. Please refresh and try again.');
      }
      transaction.update(existingRequestRef, {
        slotsNeeded: (latestRequest.slotsNeeded ?? 1) + slotsNeeded,
      });
    });
    return loadPublicSubLotteryState(seasonId);
  }

  const requestRef = db.collection(COLLECTIONS.requests).doc();
  const now = new Date().toISOString();
  const request: SubLotteryRequest = {
    id: requestRef.id,
    seasonId,
    weekStartDate: getWeekStartDateForGameDate(scheduleEntry.gameDate),
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
    updatedAt: now,
  };

  await requestRef.set(request);
  return loadPublicSubLotteryState(seasonId);
}

export async function cancelSubRequest(input: { requestId: string; captainPin: string }): Promise<SubLotteryPublicState> {
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
    if (!isTestingSeason(request.seasonId)) {
      assertPinMatches(input.captainPin, 'SUB_LOTTERY_CAPTAIN_PIN');
    }
    const captainDeadline = getWorkflowDeadlinesForWeekStart(request.weekStartDate).captainClosesAt;
    if (!isTestingSeason(request.seasonId) && Date.now() > new Date(captainDeadline).getTime()) throw new Error('Captain requests are closed for this week.');
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
    if (!isTestingSeason(request.seasonId) && request.availabilityOpensAt && now.getTime() < new Date(request.availabilityOpensAt).getTime()) {
      throw new Error('Player entries are not open yet.');
    }
    if (!isTestingSeason(request.seasonId) && request.availabilityClosesAt && now.getTime() > new Date(request.availabilityClosesAt).getTime()) {
      throw new Error('Player entries are closed.');
    }
    if (!player.active || player.pool !== request.pool) throw new Error('This player is not eligible for this request.');

    transaction.set(availabilityRef, {
      requestId,
      playerId,
      seasonId: request.seasonId,
      enteredAt: new Date().toISOString(),
      rank: 999,
    });
  });

  return loadPublicSubLotteryState(seasonId);
}

export async function runDueDrawsForSeason(
  seasonIdInput?: string,
  now = new Date(),
  forceOpenRequests = false,
): Promise<void> {
  const seasonId = getSeasonId(seasonIdInput);
  await expireOverdueAssignments(seasonId, now);
  const db = await getSubLotteryFirestore();
  const seasonDoc = await db.collection(COLLECTIONS.seasons).doc(seasonId).get();
  const seasonName = seasonDoc.exists && typeof seasonDoc.data()?.name === 'string'
    ? String(seasonDoc.data()?.name)
    : 'Current season';
  const activeWeekStartDate = isTestingSeason(seasonId) && seasonDoc.data()?.weekStartDate
    ? String(seasonDoc.data()?.weekStartDate)
    : getSubLotteryWorkflowState(now).targetWeekStartDate;
  const requestsSnapshot = await db
    .collection(COLLECTIONS.requests)
    .where('seasonId', '==', seasonId)
    .where('status', '==', 'open')
    .get();

  const dueRequests = requestsSnapshot.docs
    .map(doc => ({ ...dataWithId<SubLotteryRequest>(doc), weekStartDate: dataWithId<SubLotteryRequest>(doc).weekStartDate || activeWeekStartDate }))
    .filter(request => (!request.weekStartDate || request.weekStartDate === activeWeekStartDate) && (forceOpenRequests || (request.drawAt && new Date(request.drawAt).getTime() <= now.getTime())));

  if (dueRequests.length === 0) {
    return;
  }

  const dueWeekLabels = new Set(dueRequests.map(request => request.weekLabel).filter(Boolean));
  const [playersSnapshot, availabilitySnapshot, assignmentsSnapshot, scheduleSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.players).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.availability).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.assignments).where('seasonId', '==', seasonId).get(),
    db.collection(COLLECTIONS.schedule).where('seasonId', '==', seasonId).get(),
  ]);

  const players = playersSnapshot.docs.map(doc => dataWithId<SubLotteryPlayer>(doc));
  const availability = availabilitySnapshot.docs.map(doc => dataWithId<SubLotteryAvailability>(doc));
  const existingAssignments = assignmentsSnapshot.docs.map(doc => dataWithId<SubLotteryAssignment>(doc));
  const scheduleById = new Map<string, SubLotteryScheduleEntry>(
    scheduleSnapshot.docs.map(doc => [doc.id, dataWithId<SubLotteryScheduleEntry>(doc)]),
  );
  const excludedPlayerIds = existingAssignments
    .filter(assignment => assignment.status !== 'declined' && assignment.status !== 'expired' && assignment.weekLabel && dueWeekLabels.has(assignment.weekLabel))
    .map(assignment => assignment.playerId);
  const seed = randomBytes(32).toString('hex');
  const seedCommitment = sha256(seed);
  const commitmentBatch = db.batch();
  dueRequests.forEach(request => commitmentBatch.set(db.collection(COLLECTIONS.draws).doc(`${request.id}_initial`), {
    id: `${request.id}_initial`, seasonId, weekStartDate: request.weekStartDate, requestId: request.id,
    algorithmVersion: 'weighted-ranked-v2', seedCommitment, inputHash: '', eligiblePlayerIds: [], weights: {}, ranks: {}, requestOrder: dueRequests.map(item => item.id), excludedPlayerIds, winnerPlayerIds: [], createdAt: now.toISOString(), initiator: isTestingSeason(seasonId) ? 'testing' : forceOpenRequests ? 'admin' : 'scheduled', commitmentCreatedAt: new Date().toISOString(),
  }, { merge: false }));
  await commitmentBatch.commit();
  const drawCycle = runSubLotteryDrawCycle({
    requests: dueRequests,
    players,
    availability,
    excludedPlayerIds,
    now,
    random: deterministicRandom(seed),
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
        ...(request.assignedAt ? { assignedAt: request.assignedAt } : {}),
      });
      updatedRequestIds.add(request.id);
    }

    drawCycle.assignments.filter(assignment => updatedRequestIds.has(assignment.requestId)).forEach(assignment => {
      const assignmentRef = db.collection(COLLECTIONS.assignments).doc(`${assignment.requestId}_${assignment.playerId}`);
      const request = drawCycle.requests.find(item => item.id === assignment.requestId)!;
      transaction.set(assignmentRef, { ...assignment, id: assignmentRef.id, weekStartDate: request.weekStartDate, status: 'accepted', replacementRound: 0, countApplied: true });
      transaction.update(db.collection(COLLECTIONS.players).doc(assignment.playerId), {
        seasonSubCount: FieldValue.increment(1),
      });

      const assignedPlayer = players.find(player => player.id === assignment.playerId);
      const playerEmail = assignedPlayer?.email?.trim();
      const captainEmail = request.scheduleEntryId ? scheduleById.get(request.scheduleEntryId)?.captainEmail?.trim() : undefined;
      if (playerEmail) {
        const notificationId = `${assignment.requestId}_${assignment.playerId}`;
        const notification: SubLotteryWinnerEmailNotification = {
          id: notificationId,
          seasonId: assignment.seasonId ?? seasonId,
          requestId: assignment.requestId,
          playerId: assignment.playerId,
          playerName: assignedPlayer.name,
          playerEmail,
          seasonName,
          ...(assignment.teamName ? { teamName: assignment.teamName } : {}),
          ...(assignment.gameLabel ? { gameLabel: assignment.gameLabel } : {}),
          ...(assignment.weekLabel ? { weekLabel: assignment.weekLabel } : {}),
          ...(assignment.captainName ? { captainName: assignment.captainName } : {}),
          ...(captainEmail ? { captainEmail } : {}),
          kind: 'winner',
          assignedAt: assignment.assignedAt,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          status: 'pending',
          attempts: 0,
        };
        transaction.create(db.collection(COLLECTIONS.winnerEmails).doc(notificationId), notification);
      }
    });

    drawCycle.requests.filter(request => updatedRequestIds.has(request.id)).forEach(request => {
      const slotsNeeded = request.slotsNeeded ?? 1;
      const slotsFilled = request.assignedPlayerIds?.length ?? 0;
      if (slotsFilled >= slotsNeeded) return;
      const captainEmail = request.scheduleEntryId ? scheduleById.get(request.scheduleEntryId)?.captainEmail?.trim() : undefined;
      if (!captainEmail) return;
      const notificationId = `${request.id}_captain-unfilled`;
      const notification: SubLotteryWinnerEmailNotification = {
        id: notificationId,
        seasonId,
        requestId: request.id,
        playerId: '',
        playerName: '',
        playerEmail: captainEmail,
        recipientEmail: captainEmail,
        captainEmail,
        captainName: request.captainName,
        seasonName,
        teamName: request.teamName,
        gameLabel: request.gameLabel,
        weekLabel: request.weekLabel,
        slotsNeeded,
        slotsFilled,
        kind: 'captain-unfilled',
        assignedAt: request.assignedAt ?? now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        status: 'pending',
        attempts: 0,
      };
      transaction.create(db.collection(COLLECTIONS.winnerEmails).doc(notificationId), notification);
    });

    drawCycle.requests.filter(request => updatedRequestIds.has(request.id)).forEach(request => {
      const requestAvailability = availability.filter(entry => entry.requestId === request.id);
      const eligible = players.filter(player => player.active && player.pool === request.pool && requestAvailability.some(entry => entry.playerId === player.id));
      const weights = Object.fromEntries(calculateLotteryEntries(eligible).map(entry => [entry.playerId, entry.weight]));
      const ranks = Object.fromEntries(requestAvailability.map(entry => [entry.playerId, entry.rank ?? 999]));
      const winnerPlayerIds = drawCycle.assignments.filter(item => item.requestId === request.id).map(item => item.playerId);
      const input = { eligiblePlayerIds: eligible.map(player => player.id), weights, ranks, requestOrder: dueRequests.map(item => item.id), excludedPlayerIds };
      const drawRef = db.collection(COLLECTIONS.draws).doc(`${request.id}_initial`);
      const record: SubLotteryDrawRecord = { id: drawRef.id, seasonId, weekStartDate: request.weekStartDate, requestId: request.id, algorithmVersion: 'weighted-ranked-v2', seedCommitment, seedReveal: seed, inputHash: sha256(JSON.stringify(input)), ...input, winnerPlayerIds, createdAt: now.toISOString(), initiator: isTestingSeason(seasonId) ? 'testing' : forceOpenRequests ? 'admin' : 'scheduled' };
      transaction.set(drawRef, record);
    });
  });
  await writeAudit('draw-completed', { seasonId, requestIds: dueRequests.map(request => request.id), seedCommitment }, forceOpenRequests ? 'admin' : 'scheduler');
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
  const seasonDoc = await db.collection(COLLECTIONS.seasons).doc(seasonId).get();
  const seasonName = seasonDoc.exists && typeof seasonDoc.data()?.name === 'string'
    ? String(seasonDoc.data()?.name)
    : 'Current season';
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
      const result = await sendWinnerEmail({
        ...claimedNotification,
        seasonName: claimedNotification.seasonName ?? seasonName,
      });
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

export async function respondToAssignment(input: { token: string; response: 'accept' | 'decline' }): Promise<{ status: 'accepted' | 'declined'; message: string }> {
  if (!input.token || !['accept', 'decline'].includes(input.response)) throw new Error('Invalid response link.');
  const db = await getSubLotteryFirestore();
  const snapshot = await db.collection(COLLECTIONS.assignments).where('responseTokenHash', '==', sha256(input.token)).limit(1).get();
  if (snapshot.empty) throw new Error('This response link is invalid or has already been replaced.');
  const ref = snapshot.docs[0]!.ref;
  const assignment = dataWithId<SubLotteryAssignment>(snapshot.docs[0]!);
  if (assignment.status !== 'pending') throw new Error(`This selection was already ${assignment.status}.`);
  const now = new Date();
  if (assignment.responseDeadlineAt && now > new Date(assignment.responseDeadlineAt)) {
    await ref.update({ status: 'expired', respondedAt: now.toISOString() });
    await writeAudit('assignment-expired', { assignmentId: ref.id }, 'winner');
    throw new Error('This response deadline has passed. An administrator can run a replacement draw.');
  }
  const playerRef = db.collection(COLLECTIONS.players).doc(assignment.playerId);
  const requestRef = db.collection(COLLECTIONS.requests).doc(assignment.requestId);
  await db.runTransaction(async transaction => {
    const [latest, playerDoc] = await Promise.all([transaction.get(ref), transaction.get(playerRef)]);
    if (!latest.exists || latest.data()?.status !== 'pending') throw new Error('This selection was already answered.');
    transaction.update(ref, { status: input.response === 'accept' ? 'accepted' : 'declined', respondedAt: now.toISOString(), responseTokenHash: '' });
    if (input.response === 'accept' && playerDoc.exists && !latest.data()?.countApplied) {
      transaction.update(playerRef, { seasonSubCount: Number(playerDoc.data()?.seasonSubCount ?? 0) + 1 });
      transaction.update(ref, { countApplied: true });
      transaction.update(requestRef, { status: 'assigned', updatedAt: now.toISOString() });
    }
  });
  if (input.response === 'accept') {
    const [playerDoc, requestDoc] = await Promise.all([playerRef.get(), requestRef.get()]);
    const player = dataWithId<SubLotteryPlayer>(playerDoc);
    const request = dataWithId<SubLotteryRequest>(requestDoc);
    const schedule = request.scheduleEntryId ? await db.collection(COLLECTIONS.schedule).doc(request.scheduleEntryId).get() : null;
    const captainEmail = schedule?.data()?.captainEmail as string | undefined;
    const notifications: SubLotteryWinnerEmailNotification[] = [{
      id: `${ref.id}_winner-confirmed`, seasonId: request.seasonId, requestId: request.id, playerId: player.id, playerName: player.name, playerEmail: player.email ?? '', recipientEmail: player.email, kind: 'winner-confirmation', captainName: request.captainName, captainContact: captainEmail, teamName: request.teamName, gameLabel: request.gameLabel, weekLabel: request.weekLabel, assignedAt: assignment.assignedAt, createdAt: now.toISOString(), status: 'pending', attempts: 0,
    }];
    if (captainEmail) notifications.push({ ...notifications[0]!, id: `${ref.id}_captain-confirmed`, kind: 'captain-confirmation', recipientEmail: captainEmail, captainEmail });
    const batch = db.batch(); notifications.forEach(item => batch.set(db.collection(COLLECTIONS.winnerEmails).doc(item.id), item)); await batch.commit();
    await sendPendingWinnerEmailsForSeason(request.seasonId);
  } else {
    const playerDoc = await playerRef.get(); const requestDoc = await requestRef.get();
    const player = dataWithId<SubLotteryPlayer>(playerDoc); const request = dataWithId<SubLotteryRequest>(requestDoc);
    if (player.email) {
      const notification: SubLotteryWinnerEmailNotification = { id: `${ref.id}_declined`, seasonId: request.seasonId, requestId: request.id, playerId: player.id, playerName: player.name, playerEmail: player.email, kind: 'decline', captainName: request.captainName, teamName: request.teamName, gameLabel: request.gameLabel, weekLabel: request.weekLabel, assignedAt: assignment.assignedAt, createdAt: now.toISOString(), status: 'pending', attempts: 0 };
      await db.collection(COLLECTIONS.winnerEmails).doc(notification.id).set(notification); await sendPendingWinnerEmailsForSeason(request.seasonId);
    }
  }
  await writeAudit(`assignment-${input.response === 'accept' ? 'accepted' : 'declined'}`, { assignmentId: ref.id, requestId: assignment.requestId }, 'winner');
  return { status: input.response === 'accept' ? 'accepted' : 'declined', message: input.response === 'accept' ? 'Your spot is confirmed. The captain has been notified.' : 'You declined the spot. The administrator can now draw a replacement.' };
}

export async function runReplacementDraw(assignmentId: string): Promise<void> {
  const db = await getSubLotteryFirestore();
  const oldDoc = await db.collection(COLLECTIONS.assignments).doc(assignmentId).get();
  if (!oldDoc.exists) throw new Error('Assignment not found.');
  const old = dataWithId<SubLotteryAssignment>(oldDoc);
  if (old.status !== 'declined' && old.status !== 'expired') throw new Error('Only declined or expired assignments can be replaced.');
  const [requestDoc, playersSnapshot, availabilitySnapshot, assignmentsSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.requests).doc(old.requestId).get(),
    db.collection(COLLECTIONS.players).where('seasonId', '==', old.seasonId).get(),
    db.collection(COLLECTIONS.availability).where('seasonId', '==', old.seasonId).get(),
    db.collection(COLLECTIONS.assignments).where('seasonId', '==', old.seasonId).get(),
  ]);
  const request = dataWithId<SubLotteryRequest>(requestDoc);
  const scheduleDoc = request.scheduleEntryId ? await db.collection(COLLECTIONS.schedule).doc(request.scheduleEntryId).get() : null;
  const captainEmail = scheduleDoc?.data()?.captainEmail as string | undefined;
  const excluded = new Set(assignmentsSnapshot.docs.map(doc => dataWithId<SubLotteryAssignment>(doc)).filter(item => item.weekStartDate === old.weekStartDate).map(item => item.playerId));
  const availableIds = new Set(availabilitySnapshot.docs.map(doc => dataWithId<SubLotteryAvailability>(doc)).filter(item => item.requestId === old.requestId).map(item => item.playerId));
  const candidates = playersSnapshot.docs.map(doc => dataWithId<SubLotteryPlayer>(doc)).filter(player => player.active && player.pool === request.pool && availableIds.has(player.id) && !excluded.has(player.id));
  const seed = randomBytes(32).toString('hex');
  const winner = drawWeightedSubWinner(candidates, deterministicRandom(seed));
  if (!winner) throw new Error('No eligible replacement players remain.');
  const now = new Date();
  const round = (old.replacementRound ?? 0) + 1;
  const ref = db.collection(COLLECTIONS.assignments).doc(`${old.requestId}_${winner.id}_r${round}`);
  const replacement: SubLotteryAssignment = { ...old, id: ref.id, playerId: winner.id, assignedAt: now.toISOString(), eligiblePlayerIds: candidates.map(item => item.id), status: 'accepted', responseDeadlineAt: '', responseTokenHash: '', replacementRound: round, countApplied: true };
  const notification: SubLotteryWinnerEmailNotification = { id: ref.id, seasonId: old.seasonId ?? request.seasonId, requestId: old.requestId, playerId: winner.id, playerName: winner.name, playerEmail: winner.email ?? '', kind: 'replacement', captainName: request.captainName, ...(captainEmail?.trim() ? { captainEmail: captainEmail.trim() } : {}), teamName: request.teamName, gameLabel: request.gameLabel, weekLabel: request.weekLabel, assignedAt: now.toISOString(), createdAt: now.toISOString(), status: 'pending', attempts: 0 };
  const batch = db.batch(); batch.set(ref, replacement); batch.set(db.collection(COLLECTIONS.winnerEmails).doc(notification.id), notification); batch.update(db.collection(COLLECTIONS.players).doc(winner.id), { seasonSubCount: FieldValue.increment(1) }); batch.update(requestDoc.ref, { status: 'assigned', assignedPlayerIds: [...(request.assignedPlayerIds ?? []).filter(id => id !== old.playerId), winner.id], updatedAt: now.toISOString() });
  const input = { eligiblePlayerIds: candidates.map(item => item.id), weights: Object.fromEntries(calculateLotteryEntries(candidates).map(item => [item.playerId, item.weight])), ranks: {}, requestOrder: [request.id], excludedPlayerIds: [...excluded] };
  const drawRef = db.collection(COLLECTIONS.draws).doc(`${request.id}_replacement_${round}`); batch.set(drawRef, { id: drawRef.id, seasonId: request.seasonId, weekStartDate: request.weekStartDate, requestId: request.id, algorithmVersion: 'weighted-ranked-v2', seedCommitment: sha256(seed), seedReveal: seed, inputHash: sha256(JSON.stringify(input)), ...input, winnerPlayerIds: [winner.id], createdAt: now.toISOString(), initiator: 'replacement' } satisfies SubLotteryDrawRecord); await batch.commit();
  await sendPendingWinnerEmailsForSeason(request.seasonId);
  await writeAudit('replacement-drawn', { assignmentId, replacementAssignmentId: ref.id, requestId: request.id }, 'admin');
}

export async function loadAdminOperations(seasonIdInput?: string) {
  const seasonId = getSeasonId(seasonIdInput); await expireOverdueAssignments(seasonId); const db = await getSubLotteryFirestore();
  const [seasons, requests, assignments, emails, draws, audit] = await Promise.all([
    db.collection(COLLECTIONS.seasons).get(), db.collection(COLLECTIONS.requests).where('seasonId', '==', seasonId).get(), db.collection(COLLECTIONS.assignments).where('seasonId', '==', seasonId).get(), db.collection(COLLECTIONS.winnerEmails).where('seasonId', '==', seasonId).get(), db.collection(COLLECTIONS.draws).where('seasonId', '==', seasonId).get(), db.collection(COLLECTIONS.audit).orderBy('createdAt', 'desc').limit(100).get(),
  ]);
  const requestData = requests.docs.map(doc => dataWithId<SubLotteryRequest>(doc));
  return { state: await loadPublicSubLotteryState(seasonId), seasons: seasons.docs.map(doc => dataWithId<Record<string, unknown>>(doc)), weeks: [...new Set(requestData.map(request => request.weekStartDate).filter(Boolean))].sort().reverse(), historicalRequests: requestData, assignments: assignments.docs.map(doc => dataWithId<SubLotteryAssignment>(doc)), emails: emails.docs.map(doc => dataWithId<SubLotteryWinnerEmailNotification>(doc)), draws: draws.docs.map(doc => dataWithId<SubLotteryDrawRecord>(doc)), audit: audit.docs.map(doc => dataWithId<Record<string, unknown>>(doc)), emailConfigured: isWinnerEmailConfigured() };
}

export async function retryEmail(notificationId: string): Promise<void> {
  const db = await getSubLotteryFirestore(); const ref = db.collection(COLLECTIONS.winnerEmails).doc(notificationId); const doc = await ref.get(); if (!doc.exists) throw new Error('Email notification not found.'); await ref.update({ status: 'pending', attempts: 0, updatedAt: new Date().toISOString(), lastError: '' }); await sendPendingWinnerEmailsForSeason(String(doc.data()?.seasonId)); await writeAudit('email-retry-requested', { notificationId }, 'admin');
}

export async function sendSafeTestEmail(template: SubLotteryWinnerEmailNotification['kind']): Promise<{ to: string }> {
  const to = process.env.SUB_LOTTERY_TEST_EMAIL_TO?.trim() || 'barrieultimatesubs@gmail.com';
  const notification: SubLotteryWinnerEmailNotification = { id: 'test', seasonId: 'test', requestId: 'test', playerId: 'test', playerName: 'Test Sub', playerEmail: to, recipientEmail: to, kind: template, test: true, captainName: 'Test Captain', captainEmail: to, captainContact: to, teamName: 'Test Team', gameLabel: 'Monday 7:00 PM', weekLabel: 'Test Week', responseToken: 'safe-test-token', responseDeadlineAt: new Date(Date.now() + 3600000).toISOString(), assignedAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: 'pending', attempts: 0 };
  const result = await sendWinnerEmail(notification); if (result.status !== 'sent') throw new Error(result.message ?? 'Test email was not sent.');
  await writeAudit('test-email-sent', { template, to }, 'admin'); return { to };
}

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function deterministicRandom(seed: string): () => number {
  let counter = 0;
  return () => createHash('sha256').update(`${seed}:${counter++}`).digest().readUIntBE(0, 6) / 281474976710656;
}
function seasonScopedId(seasonId: string, value: string): string { return `${seasonId}__${sha256(value).slice(0, 24)}`; }
async function writeAudit(action: string, details: Record<string, unknown>, actor = 'system'): Promise<void> {
  const db = await getSubLotteryFirestore();
  const ref = db.collection(COLLECTIONS.audit).doc();
  await ref.set({ id: ref.id, action, actor, details, createdAt: new Date().toISOString() });
}
async function expireOverdueAssignments(seasonId: string, now = new Date()): Promise<number> {
  const db = await getSubLotteryFirestore();
  const snapshot = await db.collection(COLLECTIONS.assignments).where('seasonId', '==', seasonId).get();
  const overdue = snapshot.docs.filter(doc => doc.data().status === 'pending' && doc.data().responseDeadlineAt && new Date(doc.data().responseDeadlineAt).getTime() < now.getTime());
  if (!overdue.length) return 0;
  const batch = db.batch(); overdue.forEach(doc => batch.update(doc.ref, { status: 'expired', respondedAt: now.toISOString(), responseTokenHash: '' })); await batch.commit();
  await writeAudit('assignments-expired', { seasonId, assignmentIds: overdue.map(doc => doc.id) }); return overdue.length;
}

export async function loadOrCreateTestingWeek(reset = false): Promise<SubLotteryPublicState> {
  const fixture = getPersistedSubLotteryTestingFixture('captain');
  const { seasonId } = fixture.state;
  const db = await getSubLotteryFirestore();
  const seasonRef = db.collection(COLLECTIONS.seasons).doc(seasonId);
  const seasonDoc = await seasonRef.get();

  if (seasonDoc.exists && !reset) {
    return loadPublicSubLotteryState(seasonId);
  }

  const batch = db.batch();
  if (reset) {
    const collectionNames = Object.values(COLLECTIONS).filter(collectionName => collectionName !== COLLECTIONS.seasons);
    const existingSnapshots = await Promise.all(collectionNames.map(collectionName => (
      db.collection(collectionName).where('seasonId', '==', seasonId).get()
    )));
    existingSnapshots.forEach(snapshot => snapshot.docs.forEach(doc => batch.delete(doc.ref)));
  }

  const now = new Date().toISOString();
  batch.set(seasonRef, {
    id: seasonId,
    name: fixture.state.seasonName,
    weekStartDate: fixture.weekStartDate,
    testing: true,
    createdAt: seasonDoc.data()?.createdAt ?? now,
    updatedAt: now,
  });
  fixture.state.players.forEach(player => batch.set(db.collection(COLLECTIONS.players).doc(player.id), {
    ...player,
    seasonId,
  }));
  fixture.state.scheduleEntries.forEach(entry => batch.set(db.collection(COLLECTIONS.schedule).doc(entry.id), entry));
  await batch.commit();

  return loadPublicSubLotteryState(seasonId);
}

export async function updatePlayerPreferences(input: { playerId: string; requestIds: string[] }): Promise<SubLotteryPublicState> {
  const db = await getSubLotteryFirestore();
  const playerDoc = await db.collection(COLLECTIONS.players).doc(input.playerId).get();
  if (!playerDoc.exists) throw new Error('Player not found.');
  const player = dataWithId<SubLotteryPlayer & { seasonId: string }>(playerDoc);
  const uniqueIds = [...new Set(input.requestIds)];
  const requestDocs = await Promise.all(uniqueIds.map(id => db.collection(COLLECTIONS.requests).doc(id).get()));
  const now = new Date();
  requestDocs.forEach(doc => {
    const request = doc.exists ? dataWithId<SubLotteryRequest>(doc) : null;
    if (!request || request.seasonId !== player.seasonId || request.status !== 'open' || request.pool !== player.pool) throw new Error('One or more preferences are not eligible.');
    if (!isTestingSeason(request.seasonId) && request.availabilityClosesAt && now > new Date(request.availabilityClosesAt)) throw new Error('Player entries are closed.');
  });
  const existing = await db.collection(COLLECTIONS.availability).where('seasonId', '==', player.seasonId).get();
  const own = existing.docs.filter(doc => doc.data().playerId === input.playerId);
  const batch = db.batch();
  own.filter(doc => !uniqueIds.includes(String(doc.data().requestId))).forEach(doc => batch.delete(doc.ref));
  uniqueIds.forEach((requestId, index) => batch.set(db.collection(COLLECTIONS.availability).doc(`${requestId}_${input.playerId}`), {
    requestId, playerId: input.playerId, seasonId: player.seasonId, rank: index + 1,
    enteredAt: own.find(doc => doc.data().requestId === requestId)?.data().enteredAt ?? now.toISOString(),
  }, { merge: true }));
  await batch.commit();
  return loadPublicSubLotteryState(player.seasonId);
}

export async function updateSubRequest(input: { requestId: string; captainPin: string; pool: 'open' | 'female'; slotsNeeded: number; confirmMerge?: boolean }): Promise<SubLotteryPublicState> {
  if (!Number.isInteger(input.slotsNeeded) || input.slotsNeeded < 1) throw new Error('Choose a whole number of subs needed.');
  const db = await getSubLotteryFirestore();
  const ref = db.collection(COLLECTIONS.requests).doc(input.requestId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Sub request not found.');
  const request = dataWithId<SubLotteryRequest>(doc);
  if (!isTestingSeason(request.seasonId)) {
    assertPinMatches(input.captainPin, 'SUB_LOTTERY_CAPTAIN_PIN');
  }
  if (request.status !== 'open') throw new Error('Only open requests can be edited.');
  const deadline = getWorkflowDeadlinesForWeekStart(request.weekStartDate).captainClosesAt;
  if (!isTestingSeason(request.seasonId) && Date.now() > new Date(deadline).getTime()) throw new Error('Captain requests are closed for this week.');
  const collision = await db.collection(COLLECTIONS.requests).where('seasonId', '==', request.seasonId).where('scheduleEntryId', '==', request.scheduleEntryId).where('pool', '==', input.pool).where('status', '==', 'open').get();
  const other = collision.docs.find(item => item.id !== request.id);
  if (other && !input.confirmMerge) throw new Error('MERGE_CONFIRMATION_REQUIRED');
  if (other) {
    const otherData = dataWithId<SubLotteryRequest>(other);
    const batch = db.batch();
    batch.update(other.ref, { slotsNeeded: (otherData.slotsNeeded ?? 1) + input.slotsNeeded, updatedAt: new Date().toISOString() });
    batch.update(ref, { status: 'void', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString(), mergedIntoRequestId: other.id });
    await batch.commit();
  } else await ref.update({ pool: input.pool, slotsNeeded: input.slotsNeeded, updatedAt: new Date().toISOString() });
  await writeAudit('captain-request-updated', { requestId: request.id, pool: input.pool, slotsNeeded: input.slotsNeeded }, 'captain');
  return loadPublicSubLotteryState(request.seasonId);
}

export async function runTestingWeekDraw(seasonId: string): Promise<SubLotteryPublicState> {
  if (!isTestingSeason(seasonId)) {
    throw new Error('Only a saved testing week can be drawn manually.');
  }

  const weekStartDate = seasonId.slice('testing-'.length);
  const simulatedDrawTime = new Date(new Date(getWorkflowDeadlinesForWeekStart(weekStartDate).drawAt).getTime() + 1000);
  await runDueDrawsForSeason(seasonId, simulatedDrawTime, true);
  return loadPublicSubLotteryState(seasonId);
}

export async function importSubPlayers(input: {
  seasonId?: string;
  seasonName: string;
  adminPin: string;
  csvText: string;
}): Promise<SubLotteryPublicState> {
  assertPinMatches(input.adminPin, 'SUB_LOTTERY_ADMIN_PIN');

  const seasonId = getSeasonId(input.seasonId);
  const parsedPlayers = parseSubPlayerCsv(input.csvText);

  if (parsedPlayers.length === 0) {
    throw new Error('No valid players found. Use CSV headers: Name,Pool,Email. Email is required.');
  }
  if (parsedPlayers.some(player => !player.email)) throw new Error('Every player needs an email address. Use CSV headers: Name,Pool,Email.');

  const duplicateEmails = parsedPlayers.map(player => normalizeSubLotteryEmail(player.email ?? '')).filter((email, index, emails) => emails.indexOf(email) !== index);
  if (duplicateEmails.length > 0) {
    throw new Error('Duplicate player emails found. Each player email must be unique within the season.');
  }

  const db = await getSubLotteryFirestore();
  const existingPlayers = await db.collection(COLLECTIONS.players).where('seasonId', '==', seasonId).get();
  const existingByEmail = new Map(existingPlayers.docs.map(doc => [normalizeSubLotteryEmail(String(doc.data().email ?? '')), dataWithId<SubLotteryPlayer>(doc)]));
  const players = parsedPlayers.map(player => {
    const email = normalizeSubLotteryEmail(player.email ?? '');
    const existing = existingByEmail.get(email);
    return { ...player, id: existing?.id ?? seasonScopedId(seasonId, email), email, seasonId, seasonSubCount: existing?.seasonSubCount ?? 0 };
  });
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
  await writeAudit('players-imported', { seasonId, count: players.length }, 'admin');
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
    ...(entry.gameDate ? { weekStartDate: getWeekStartDateForGameDate(entry.gameDate) } : {}),
  }));

  if (scheduleEntries.length === 0) {
    throw new Error('No valid schedule entries found. Use CSV headers: Week,Date,Captain,Captain Email,Team,Game Time. Captain Email is required.');
  }
  if (scheduleEntries.some(entry => !entry.gameDate || !entry.captainEmail)) throw new Error('Every schedule row needs Date and Captain Email.');

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
    const id = seasonScopedId(seasonId, `${entry.weekStartDate}|${entry.captainEmail}|${entry.teamName}|${entry.gameLabel}`);
    batch.set(db.collection(COLLECTIONS.schedule).doc(id), { ...entry, id }, { merge: true });
  });

  await batch.commit();
  await writeAudit('schedule-imported', { seasonId, count: scheduleEntries.length }, 'admin');
  return loadPublicSubLotteryState(seasonId);
}
