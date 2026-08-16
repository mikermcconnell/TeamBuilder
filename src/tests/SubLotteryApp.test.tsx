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
  assignments: [],
};

vi.mock('@/sub-lottery/api', () => ({
  loadSubLotteryState: vi.fn(async () => emptyState),
  createCaptainRequest: vi.fn(),
  markAvailable: vi.fn(),
  cancelCaptainRequest: vi.fn(),
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

    expect(screen.getByText('Demo data is showing. This is not the live sub lottery.')).toBeInTheDocument();
    expect(screen.getByText('Are you a sub or a captain?')).toBeInTheDocument();
    expect(screen.getByText('I’m a sub player')).toBeInTheDocument();
    expect(screen.getByText('I’m a captain')).toBeInTheDocument();
    expect(screen.getByText('Game week: Week 2')).toBeInTheDocument();
    expect(document.querySelector('#captain-name-suggestions option[value="Jamie"]')).toBeInTheDocument();
    expect(document.querySelector('#captain-name-suggestions option[value="Avery"]')).toBeInTheDocument();
  });
});
