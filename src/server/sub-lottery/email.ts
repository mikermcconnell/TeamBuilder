import { createRequire } from 'node:module';

import type { SubLotteryWinnerEmailNotification } from '../../sub-lottery/types.js';

const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer') as typeof import('nodemailer');

export interface SendWinnerEmailResult {
  status: 'sent' | 'skipped';
  message?: string;
}

export interface WinnerEmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isWinnerEmailConfigured(): boolean {
  return Boolean(
    isSmtpConfigured()
    || (process.env.RESEND_API_KEY?.trim() && process.env.SUB_LOTTERY_EMAIL_FROM?.trim())
  );
}

export function buildWinnerEmail(notification: SubLotteryWinnerEmailNotification): WinnerEmailMessage {
  const prefix = notification.test ? '[TEST] ' : (process.env.SUB_LOTTERY_EMAIL_SUBJECT_PREFIX ?? '');
  const gameParts = [
    notification.weekLabel,
    notification.teamName,
    notification.gameLabel,
  ].filter(Boolean);
  const gameLine = gameParts.join(' · ') || 'your game';
  const publicUrl = (process.env.SUB_LOTTERY_PUBLIC_URL ?? 'http://localhost:5173/sub-lottery').replace(/\/$/, '');
  const responseUrl = notification.responseToken ? `${publicUrl}/respond?token=${encodeURIComponent(notification.responseToken)}` : '';
  const kind = notification.kind ?? 'winner';
  if (kind === 'captain-confirmation') {
    const subject = `${prefix}Sub confirmed for ${notification.teamName ?? 'your game'}`;
    const text = `Hi ${notification.captainName ?? 'Captain'},\n\n${notification.playerName} (${notification.playerEmail}) has accepted and will sub for ${gameLine}.\n\nSub Squad`;
    return { to: notification.recipientEmail ?? notification.captainEmail ?? notification.playerEmail, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>` };
  }
  if (kind === 'winner-confirmation') {
    const subject = `${prefix}Confirmed: ${notification.teamName ?? 'your sub game'}`;
    const text = `Hi ${notification.playerName},\n\nYou are confirmed for ${gameLine}. Captain contact: ${notification.captainContact ?? notification.captainName ?? 'see the league schedule'}.\n\nSub Squad`;
    return { to: notification.recipientEmail ?? notification.playerEmail, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>` };
  }
  if (kind === 'decline') {
    const subject = `${prefix}Decline received for ${notification.teamName ?? 'your sub game'}`;
    const text = `Hi ${notification.playerName},\n\nYour decline for ${gameLine} was received. You will not be selected again this week.\n\nSub Squad`;
    return { to: notification.recipientEmail ?? notification.playerEmail, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>` };
  }
  const subject = `${prefix}${kind === 'replacement' ? 'Replacement spot available' : 'You won the sub lottery'} for ${notification.teamName ?? 'your sub game'}`;
  const text = [
    `Hi ${notification.playerName},`,
    '',
    `${kind === 'replacement' ? 'You were selected as a replacement' : 'You won the sub lottery'} for ${gameLine}.`,
    `Please accept or decline by ${notification.responseDeadlineAt ?? 'the response deadline'}.`,
    responseUrl,
    '',
    'Have a great game!',
    'Sub Squad',
  ].join('\n');
  const html = [
    `<p>Hi ${escapeHtml(notification.playerName)},</p>`,
    `<p>${kind === 'replacement' ? 'You were selected as a replacement' : 'You won the sub lottery'} for <strong>${escapeHtml(gameLine)}</strong>.</p>`,
    `<p>Please <a href="${escapeHtml(responseUrl)}">accept or decline</a> by ${escapeHtml(notification.responseDeadlineAt ?? 'the response deadline')}.</p>`,
    '<p>Have a great game!<br/>Sub Squad</p>',
  ].join('');

  return {
    to: notification.recipientEmail ?? notification.playerEmail,
    subject,
    text,
    html,
  };
}

export async function sendWinnerEmail(notification: SubLotteryWinnerEmailNotification): Promise<SendWinnerEmailResult> {
  if (isSmtpConfigured()) {
    return sendWinnerEmailWithSmtp(notification);
  }

  return sendWinnerEmailWithResend(notification);
}

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim()
    && process.env.SMTP_PORT?.trim()
    && process.env.SMTP_USER?.trim()
    && process.env.SMTP_PASS?.trim()
    && process.env.SUB_LOTTERY_EMAIL_FROM?.trim()
  );
}

async function sendWinnerEmailWithSmtp(notification: SubLotteryWinnerEmailNotification): Promise<SendWinnerEmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT?.trim());
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SUB_LOTTERY_EMAIL_FROM?.trim();

  if (!host || !Number.isInteger(port) || !user || !pass || !from) {
    return {
      status: 'skipped',
      message: 'SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SUB_LOTTERY_EMAIL_FROM.',
    };
  }

  const message = buildWinnerEmail(notification);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return { status: 'sent' };
}

async function sendWinnerEmailWithResend(notification: SubLotteryWinnerEmailNotification): Promise<SendWinnerEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SUB_LOTTERY_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      status: 'skipped',
      message: 'Winner email is not configured. Set RESEND_API_KEY and SUB_LOTTERY_EMAIL_FROM.',
    };
  }

  const message = buildWinnerEmail(notification);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Resend returned ${response.status}.`);
  }

  return { status: 'sent' };
}
