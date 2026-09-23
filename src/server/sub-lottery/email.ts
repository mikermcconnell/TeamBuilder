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
  cc?: string;
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

function buildBrandedHtml(content: string, notification: SubLotteryWinnerEmailNotification, publicUrl: string): string {
  const logoUrl = new URL('/barrie-ultimate-logo.jpg', publicUrl).toString();
  const seasonName = notification.seasonName?.trim();

  return [
    '<div style="margin:0;background:#f8f8f8;padding:24px;font-family:Arial,sans-serif;color:#333333">',
    '<div style="margin:0 auto;max-width:620px;overflow:hidden;border:1px solid #eeeeee;border-top:5px solid #0071bb;background:#ffffff">',
    '<div style="padding:20px 24px;border-bottom:1px solid #eeeeee">',
    `<img src="${escapeHtml(logoUrl)}" alt="Barrie Ultimate League" width="260" style="display:block;max-width:100%;height:auto"/>`,
    '<div style="margin-top:12px;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#005288">Barrie Ultimate League</div>',
    `<div style="margin-top:3px;font-size:22px;font-weight:bold;color:#333333">Sub Lottery${seasonName ? ` · ${escapeHtml(seasonName)}` : ''}</div>`,
    '</div>',
    `<div style="padding:24px;font-size:16px;line-height:1.55">${content}</div>`,
    '<div style="padding:16px 24px;background:#eef8ff;font-size:13px;font-weight:bold;color:#005288">Barrie Ultimate League · Sub Squad</div>',
    '</div>',
    '</div>',
  ].join('');
}

function buildSignature(notification: SubLotteryWinnerEmailNotification): string {
  return ['Barrie Ultimate League', notification.seasonName?.trim(), 'Sub Squad'].filter(Boolean).join('\n');
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
  const kind = notification.kind ?? 'winner';
  if (kind === 'captain-unfilled') {
    const slotsNeeded = Math.max(1, notification.slotsNeeded ?? 1);
    const slotsFilled = Math.max(0, notification.slotsFilled ?? 0);
    const shortfall = Math.max(1, slotsNeeded - slotsFilled);
    const subject = `${prefix}Barrie Ultimate League: ${shortfall === slotsNeeded ? 'no sub available' : 'sub request partially filled'} for ${notification.teamName ?? 'your game'}`;
    const resultLine = shortfall === slotsNeeded
      ? `No eligible sub was available for ${shortfall === 1 ? 'the requested spot' : `the ${shortfall} requested spots`}.`
      : `${slotsFilled} of ${slotsNeeded} requested spots were filled. ${shortfall} ${shortfall === 1 ? 'spot remains' : 'spots remain'} unfilled.`;
    const text = `Hi ${notification.captainName ?? 'Captain'},\n\nThe sub lottery has finished for ${gameLine}. ${resultLine}\n\n${buildSignature(notification)}`;
    const content = `<p>Hi ${escapeHtml(notification.captainName ?? 'Captain')},</p><p>The sub lottery has finished for <strong>${escapeHtml(gameLine)}</strong>.</p><p><strong>${escapeHtml(resultLine)}</strong></p>`;
    return { to: notification.recipientEmail ?? notification.captainEmail ?? notification.playerEmail, subject, text, html: buildBrandedHtml(content, notification, publicUrl) };
  }
  if (kind === 'captain-confirmation') {
    const subject = `${prefix}Barrie Ultimate League: sub confirmed for ${notification.teamName ?? 'your game'}`;
    const text = `Hi ${notification.captainName ?? 'Captain'},\n\n${notification.playerName} (${notification.playerEmail}) has accepted and will sub for ${gameLine}.\n\n${buildSignature(notification)}`;
    const content = `<p>Hi ${escapeHtml(notification.captainName ?? 'Captain')},</p><p><strong>${escapeHtml(notification.playerName)}</strong> (${escapeHtml(notification.playerEmail)}) has accepted and will sub for ${escapeHtml(gameLine)}.</p>`;
    return { to: notification.recipientEmail ?? notification.captainEmail ?? notification.playerEmail, subject, text, html: buildBrandedHtml(content, notification, publicUrl) };
  }
  if (kind === 'winner-confirmation') {
    const subject = `${prefix}Barrie Ultimate League: confirmed for ${notification.teamName ?? 'your sub game'}`;
    const captainContact = notification.captainContact ?? notification.captainName ?? 'see the league schedule';
    const text = `Hi ${notification.playerName},\n\nYou are confirmed for ${gameLine}. Captain contact: ${captainContact}.\n\n${buildSignature(notification)}`;
    const content = `<p>Hi ${escapeHtml(notification.playerName)},</p><p>You are confirmed for <strong>${escapeHtml(gameLine)}</strong>.</p><p>Captain contact: ${escapeHtml(captainContact)}.</p>`;
    return { to: notification.recipientEmail ?? notification.playerEmail, subject, text, html: buildBrandedHtml(content, notification, publicUrl) };
  }
  if (kind === 'decline') {
    const subject = `${prefix}Barrie Ultimate League: decline received for ${notification.teamName ?? 'your sub game'}`;
    const text = `Hi ${notification.playerName},\n\nYour decline for ${gameLine} was received. You will not be selected again this week.\n\n${buildSignature(notification)}`;
    const content = `<p>Hi ${escapeHtml(notification.playerName)},</p><p>Your decline for <strong>${escapeHtml(gameLine)}</strong> was received. You will not be selected again this week.</p>`;
    return { to: notification.recipientEmail ?? notification.playerEmail, subject, text, html: buildBrandedHtml(content, notification, publicUrl) };
  }
  const subject = `${prefix}Barrie Ultimate League: ${kind === 'replacement' ? 'replacement spot available' : 'you won the sub lottery'} for ${notification.teamName ?? 'your sub game'}`;
  const text = [
    `Hi ${notification.playerName},`,
    '',
    `${kind === 'replacement' ? 'You were selected as a replacement' : 'You won the sub lottery'} for ${gameLine}.`,
    notification.captainName ? `Captain: ${notification.captainName}.` : '',
    'You are assigned to this game. No response is required.',
    '',
    'Have a great game!',
    buildSignature(notification),
  ].join('\n');
  const content = [
    `<p>Hi ${escapeHtml(notification.playerName)},</p>`,
    `<p>${kind === 'replacement' ? 'You were selected as a replacement' : 'You won the sub lottery'} for <strong>${escapeHtml(gameLine)}</strong>.</p>`,
    notification.captainName ? `<p>Captain: <strong>${escapeHtml(notification.captainName)}</strong>.</p>` : '',
    '<p><strong>You are assigned to this game. No response is required.</strong></p>',
    '<p>Have a great game!</p>',
  ].join('');

  const to = notification.recipientEmail ?? notification.playerEmail;
  const captainCc = notification.captainEmail?.trim();
  return {
    to,
    ...(captainCc && captainCc.toLowerCase() !== to.trim().toLowerCase() ? { cc: captainCc } : {}),
    subject,
    text,
    html: buildBrandedHtml(content, notification, publicUrl),
  };
}

export async function sendWinnerEmail(notification: SubLotteryWinnerEmailNotification): Promise<SendWinnerEmailResult> {
  if (isSmtpConfigured()) {
    return sendWinnerEmailWithSmtp(notification);
  }

  return sendWinnerEmailWithResend(notification);
}

export async function sendAccessCodeEmail(to: string, code: string): Promise<void> {
  const from = process.env.SUB_LOTTERY_EMAIL_FROM?.trim();
  if (!from) throw new Error('Email verification is unavailable. Contact the league administrator.');
  const subject = 'Barrie Ultimate League sub lottery sign-in code';
  const text = `Your sub lottery verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`;
  if (isSmtpConfigured()) {
    const port = Number(process.env.SMTP_PORT);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from, to, subject, text });
    return;
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('Email verification is unavailable. Contact the league administrator.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error('Verification email could not be sent. Please try again.');
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
    ...(message.cc ? { cc: message.cc } : {}),
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
      ...(message.cc ? { cc: [message.cc] } : {}),
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
