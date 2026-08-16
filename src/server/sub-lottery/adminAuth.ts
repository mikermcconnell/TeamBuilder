import { createHmac, timingSafeEqual } from 'node:crypto';

import type { SubLotteryServerlessRequest } from './http.js';

const COOKIE_NAME = 'sub_lottery_admin';
const SESSION_SECONDS = 30 * 60;

function secret(): string {
  const value = process.env.SUB_LOTTERY_ADMIN_PIN?.trim();
  if (value) return value;
  if (process.env.NODE_ENV !== 'production') return 'admin';
  throw new Error('SUB_LOTTERY_ADMIN_PIN is not configured.');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createAdminSession(): { token: string; expiresAt: string; cookie: string } {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expires);
  const token = `${payload}.${sign(payload)}`;
  return {
    token,
    expiresAt: new Date(expires * 1000).toISOString(),
    cookie: `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  };
}

export function assertAdminPin(pin: string): void {
  const actual = Buffer.from(pin.trim());
  const expected = Buffer.from(secret());
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid PIN.');
}

export function assertAdminSession(req: SubLotteryServerlessRequest): void {
  const header = req.headers?.cookie;
  const cookie = (Array.isArray(header) ? header[0] : header) ?? '';
  const token = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  const [expiresText, signature] = token?.split('.') ?? [];
  if (!expiresText || !signature || Number(expiresText) <= Math.floor(Date.now() / 1000)) throw new Error('Admin session expired. Please sign in again.');
  const expected = Buffer.from(sign(expiresText));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid admin session.');
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
