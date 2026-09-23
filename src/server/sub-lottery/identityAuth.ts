import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { SubLotteryIdentityKind } from '../../sub-lottery/apiContracts.js';
import type { SubLotteryServerlessRequest } from './http.js';
import { getSubLotteryFirestore } from './firebaseAdmin.js';
import { sendAccessCodeEmail } from './email.js';

const CODE_LIFETIME_MS = 10 * 60_000;
const SEND_COOLDOWN_MS = 60_000;
const SESSION_SECONDS = 12 * 60 * 60;
const COLLECTION = 'subLotteryVerification';

function secret(): string {
  const value = process.env.SUB_LOTTERY_SESSION_SECRET?.trim() || process.env.SUB_LOTTERY_ADMIN_PIN?.trim();
  if (value) return value;
  if (process.env.NODE_ENV !== 'production') return 'local-sub-lottery-session';
  throw new Error('Sub lottery session secret is not configured.');
}

function signature(value: string): string {
  return createHmac('sha256', secret()).update(`sub-lottery-access:${value}`).digest('base64url');
}

function equal(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookieName(kind: SubLotteryIdentityKind): string {
  return kind === 'player' ? 'sub_lottery_player' : 'sub_lottery_captain';
}

function getCookie(req: SubLotteryServerlessRequest, name: string): string {
  const header = req.headers?.cookie;
  return ((Array.isArray(header) ? header[0] : header) ?? '')
    .split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

function verificationId(kind: SubLotteryIdentityKind, subjectId: string): string {
  return createHash('sha256').update(`${kind}:${subjectId}`).digest('hex');
}

function assertKind(kind: string): asserts kind is SubLotteryIdentityKind {
  if (kind !== 'player' && kind !== 'captain') throw new Error('Choose a player or captain.');
}

async function resolveIdentity(kind: SubLotteryIdentityKind, subjectId: string): Promise<{ email: string; seasonId: string }> {
  if (!subjectId || subjectId.length > 200) throw new Error('Choose your name or scheduled game first.');
  const db = await getSubLotteryFirestore();
  const collection = kind === 'player' ? 'subLotteryPlayers' : 'subLotterySchedule';
  const doc = await db.collection(collection).doc(subjectId).get();
  const data = doc.data();
  if (!doc.exists || !data?.active) throw new Error('This player or game is no longer active. Refresh the page.');
  const email = String(data.email ?? data.captainEmail ?? '').trim();
  if (!email) throw new Error('No email is on file. Contact the league administrator.');
  return { email, seasonId: String(data.seasonId ?? '') };
}

export async function requestAccessCode(input: { kind: SubLotteryIdentityKind; subjectId: string; captainPin?: string }): Promise<void> {
  assertKind(input.kind);
  if (input.kind === 'captain') {
    const expected = process.env.SUB_LOTTERY_CAPTAIN_PIN?.trim() || (process.env.NODE_ENV !== 'production' ? 'captain' : '');
    if (!expected || !equal(input.captainPin?.trim() ?? '', expected)) throw new Error('Invalid captain PIN.');
  }
  const identity = await resolveIdentity(input.kind, input.subjectId);
  const db = await getSubLotteryFirestore();
  const ref = db.collection(COLLECTION).doc(verificationId(input.kind, input.subjectId));
  const previous = await ref.get();
  if (Date.now() - Number(previous.data()?.sentAt ?? 0) < SEND_COOLDOWN_MS) {
    throw new Error('A code was just sent. Please wait one minute before requesting another.');
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await ref.set({
    kind: input.kind, subjectId: input.subjectId, seasonId: identity.seasonId,
    codeHash: signature(`${input.kind}:${input.subjectId}:${code}`),
    expiresAt: Date.now() + CODE_LIFETIME_MS, sentAt: Date.now(), attempts: 0,
  });
  try {
    await sendAccessCodeEmail(identity.email, code);
  } catch (error) {
    await ref.delete();
    throw error;
  }
}

export async function verifyAccessCode(input: { kind: SubLotteryIdentityKind; subjectId: string; code: string }): Promise<string> {
  assertKind(input.kind);
  if (!/^\d{6}$/.test(input.code ?? '')) throw new Error('Enter the six-digit email code.');
  const db = await getSubLotteryFirestore();
  const ref = db.collection(COLLECTION).doc(verificationId(input.kind, input.subjectId));
  const doc = await ref.get();
  const data = doc.data();
  if (!data || data.expiresAt < Date.now() || data.attempts >= 5) throw new Error('Code expired. Request a new one.');
  const expected = signature(`${input.kind}:${input.subjectId}:${input.code}`);
  if (!equal(expected, String(data.codeHash ?? ''))) {
    await ref.update({ attempts: Number(data.attempts ?? 0) + 1 });
    throw new Error('That code is incorrect. Please try again.');
  }
  await ref.delete();
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = Buffer.from(JSON.stringify({ kind: input.kind, subjectId: input.subjectId, expires })).toString('base64url');
  const token = `${payload}.${signature(payload)}`;
  return `${cookieName(input.kind)}=${token}; Path=/api/sub-lottery; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function hasIdentitySession(req: SubLotteryServerlessRequest, kind: SubLotteryIdentityKind, subjectId: string): boolean {
  const [payload, signed] = getCookie(req, cookieName(kind)).split('.');
  if (!payload || !signed || !equal(signed, signature(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { kind: string; subjectId: string; expires: number };
    return data.kind === kind && data.subjectId === subjectId && data.expires > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function assertIdentitySession(req: SubLotteryServerlessRequest, kind: SubLotteryIdentityKind, subjectId: string): Promise<void> {
  const identity = await resolveIdentity(kind, subjectId);
  if (/^testing-\d{4}-\d{2}-\d{2}$/.test(identity.seasonId)) return;
  if (!hasIdentitySession(req, kind, subjectId)) throw new Error('Verify your email to make this change.');
}

export async function assertCaptainRequestSession(req: SubLotteryServerlessRequest, requestId: string): Promise<void> {
  const db = await getSubLotteryFirestore();
  const doc = await db.collection('subLotteryRequests').doc(requestId).get();
  const scheduleEntryId = doc.data()?.scheduleEntryId;
  if (!doc.exists || typeof scheduleEntryId !== 'string') throw new Error('Sub request not found.');
  await assertIdentitySession(req, 'captain', scheduleEntryId);
}
