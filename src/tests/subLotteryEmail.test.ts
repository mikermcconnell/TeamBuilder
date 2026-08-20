import { afterEach, describe, expect, test } from 'vitest';

import { buildWinnerEmail, isWinnerEmailConfigured } from '@/server/sub-lottery/email';
import type { SubLotteryWinnerEmailNotification } from '@/sub-lottery/types';

const notification: SubLotteryWinnerEmailNotification = {
  id: 'req-1_alice',
  seasonId: 'season-2026',
  requestId: 'req-1',
  playerId: 'alice',
  playerName: 'Alice Green',
  playerEmail: 'alice@example.com',
  seasonName: 'Summer Outdoor 2026',
  teamName: 'Blue Team',
  gameLabel: 'Friday 8 PM',
  weekLabel: 'Week 1',
  captainName: 'Morgan',
  captainEmail: 'morgan@example.com',
  assignedAt: '2026-06-22T16:01:00.000Z',
  createdAt: '2026-06-22T16:01:00.000Z',
  status: 'pending',
  attempts: 0,
};

describe('sub lottery winner email', () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SUB_LOTTERY_EMAIL_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  test('builds a clear winner notification email', () => {
    const email = buildWinnerEmail(notification);

    expect(email.to).toBe('alice@example.com');
    expect(email.cc).toBe('morgan@example.com');
    expect(email.subject).toContain('Blue Team');
    expect(email.subject).toContain('Barrie Ultimate League');
    expect(email.text).toContain('You won the sub lottery');
    expect(email.text).toContain('Captain: Morgan');
    expect(email.text).toContain('No response is required');
    expect(email.text).not.toContain('accept or decline');
    expect(email.html).not.toContain('/sub-lottery/respond');
    expect(email.html).toContain('Week 1 · Blue Team · Friday 8 PM');
    expect(email.html).toContain('barrie-ultimate-logo.jpg');
    expect(email.html).toContain('Summer Outdoor 2026');
  });

  test('builds an unfilled-request notification for the captain', () => {
    const email = buildWinnerEmail({
      ...notification,
      id: 'req-1_captain-unfilled',
      kind: 'captain-unfilled',
      recipientEmail: 'morgan@example.com',
      slotsNeeded: 2,
      slotsFilled: 0,
    });

    expect(email.to).toBe('morgan@example.com');
    expect(email.cc).toBeUndefined();
    expect(email.subject).toContain('no sub available');
    expect(email.text).toContain('No eligible sub was available for the 2 requested spots.');
  });

  test('requires both Resend key and sender address before sending is enabled', () => {
    process.env.RESEND_API_KEY = 're_test';
    expect(isWinnerEmailConfigured()).toBe(false);

    process.env.SUB_LOTTERY_EMAIL_FROM = 'Subs <subs@example.com>';
    expect(isWinnerEmailConfigured()).toBe(true);
  });

  test('supports SMTP configuration for Gmail or Brevo sending', () => {
    process.env.SMTP_HOST = 'smtp-relay.brevo.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'aff716001@smtp-brevo.com';
    process.env.SUB_LOTTERY_EMAIL_FROM = 'Sub Squad <barrieultimatesubs@gmail.com>';
    expect(isWinnerEmailConfigured()).toBe(false);

    process.env.SMTP_PASS = 'smtp-key';
    expect(isWinnerEmailConfigured()).toBe(true);
  });
});
