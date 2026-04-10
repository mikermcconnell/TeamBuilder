import { createHash } from 'node:crypto';

import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

type HeaderValue = string | string[] | undefined;

export interface RequestHeaders {
  [key: string]: HeaderValue;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMITS = {
  ip: { maxRequests: 12, windowMs: 60_000 },
  user: { maxRequests: 30, windowMs: 5 * 60_000 },
} as const;

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function getFirebaseProjectId(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID
    ?? process.env.VITE_FIREBASE_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT;

  if (!projectId) {
    throw new Error('Missing Firebase project ID for AI request authentication.');
  }

  return projectId;
}

function getFirebaseAdminAuth() {
  const projectId = getFirebaseProjectId();
  const app = getApps().length > 0
    ? getApp()
    : initializeApp({ projectId });

  return getAuth(app);
}

function normalizeHeaderValue(value: HeaderValue): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function getHeader(headers: RequestHeaders | undefined, name: string): string {
  if (!headers) {
    return '';
  }

  const directValue = headers[name];
  if (directValue !== undefined) {
    return normalizeHeaderValue(directValue);
  }

  const matchedKey = Object.keys(headers).find(headerName => headerName.toLowerCase() === name.toLowerCase());
  return matchedKey ? normalizeHeaderValue(headers[matchedKey]) : '';
}

function getIpAddress(headers: RequestHeaders | undefined): string {
  const forwardedFor = getHeader(headers, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return getHeader(headers, 'x-real-ip') || 'unknown';
}

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function assertWithinRateLimit(scope: 'ip' | 'user', rawKey: string) {
  const config = RATE_LIMITS[scope];
  const key = `${scope}:${hashKey(rawKey)}`;
  const now = Date.now();

  for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(bucketKey);
    }
  }

  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return;
  }

  if (existing.count >= config.maxRequests) {
    throw new Error(`RATE_LIMITED:${scope}`);
  }

  existing.count += 1;
  rateLimitBuckets.set(key, existing);
}

function getBearerToken(headers: RequestHeaders | undefined): string | null {
  const authorization = getHeader(headers, 'authorization');
  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function verifyAuthenticatedAiUser(headers: RequestHeaders | undefined): Promise<DecodedIdToken> {
  const token = getBearerToken(headers);
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const auth = getFirebaseAdminAuth();
  return auth.verifyIdToken(token);
}

export function enforceAiRateLimits(headers: RequestHeaders | undefined, userId: string) {
  assertWithinRateLimit('ip', getIpAddress(headers));
  assertWithinRateLimit('user', userId);
}
