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
  const gameParts = [
    notification.weekLabel,
    notification.teamName,
    notification.gameLabel,
  ].filter(Boolean);
  const gameLine = gameParts.join(' · ') || 'your game';
  const subject = `You are in for ${notification.teamName ?? 'your sub game'}`;
  const text = [
    `Hi ${notification.playerName},`,
    '',
    `You won the sub lottery and are in for ${gameLine}.`,
    'No confirmation is needed.',
    '',
    'Have a great game!',
    'Sub Squad',
  ].join('\n');
  const html = [
    `<p>Hi ${escapeHtml(notification.playerName)},</p>`,
    `<p>You won the sub lottery and are in for <strong>${escapeHtml(gameLine)}</strong>.</p>`,
    '<p>No confirmation is needed.</p>',
    '<p>Have a great game!<br/>Sub Squad</p>',
  ].join('');

  return {
    to: notification.playerEmail,
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
