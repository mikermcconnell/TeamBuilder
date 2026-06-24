import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { SubLotteryApp } from '@/sub-lottery/SubLotteryApp';
import type { SubLotteryPublicState } from '@/sub-lottery/types';

const emptyState: SubLotteryPublicState = {
  seasonId: 'default-season',
  seasonName: 'Current season',
  players: [],
  requests: [],
  availability: [],
  scheduleEntries: [],
};

vi.mock('@/sub-lottery/api', () => ({
  loadSubLotteryState: vi.fn(async () => emptyState),
  createCaptainRequest: vi.fn(),
  markAvailable: vi.fn(),
  runDraw: vi.fn(),
  adminImportPlayers: vi.fn(),
  adminImportSchedule: vi.fn(),
}));

describe('SubLotteryApp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-24T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('autoloads sample subs and current-week captain schedule for testing', () => {
    render(<SubLotteryApp />);

    expect(screen.getByText('Sub Squad')).toBeInTheDocument();
    expect(screen.getByText('Current week: Week 1')).toBeInTheDocument();
    expect(document.querySelector('#sub-player-suggestions option[value="Alice Green"]')).toBeInTheDocument();
    expect(document.querySelector('#sub-player-suggestions option[value="Owen Orange"]')).toBeInTheDocument();
    expect(document.querySelector('#captain-name-suggestions option[value="Morgan"]')).toBeInTheDocument();
    expect(document.querySelector('#captain-name-suggestions option[value="Riley"]')).toBeInTheDocument();
  });
});
