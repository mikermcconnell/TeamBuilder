import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createCaptainRequest, loadTestingWeek, runTestingDraw, updatePreferences } from '@/sub-lottery/api';
import { SubLotteryApp } from '@/sub-lottery/SubLotteryApp';
import { getPersistedSubLotteryTestingFixture } from '@/sub-lottery/testingFixtures';
import type { SubLotteryPublicState } from '@/sub-lottery/types';

const emptyState: SubLotteryPublicState = {
  seasonId: 'default-season',
  seasonName: 'Summer Outdoor 2026',
  players: [],
  requests: [],
  availability: [],
  scheduleEntries: [],
  assignments: [],
};

vi.mock('@/sub-lottery/api', () => ({
  loadSubLotteryState: vi.fn(async () => emptyState),
  loadTestingWeek: vi.fn(),
  runTestingDraw: vi.fn(),
  createCaptainRequest: vi.fn(),
  markAvailable: vi.fn(),
  cancelCaptainRequest: vi.fn(),
  runDraw: vi.fn(),
  adminImportPlayers: vi.fn(),
  adminImportSchedule: vi.fn(),
  updatePreferences: vi.fn(),
  updateCaptainRequest: vi.fn(),
  adminLogin: vi.fn(),
  loadAdminOperations: vi.fn(),
  adminRunReplacement: vi.fn(),
  adminRetryEmail: vi.fn(),
  adminSendTestEmail: vi.fn(),
  respondToSelection: vi.fn(),
}));

describe('SubLotteryApp', () => {
  beforeEach(() => {
    const referenceDate = new Date('2026-06-24T12:00:00.000Z');
    const playerFixture = getPersistedSubLotteryTestingFixture('player', referenceDate).state;
    const resultsFixture = getPersistedSubLotteryTestingFixture('results', referenceDate).state;
    const captainFixture = { ...playerFixture, requests: [] };
    const createdState = { ...captainFixture, requests: [playerFixture.requests[0]!] };
    vi.mocked(loadTestingWeek).mockResolvedValue(captainFixture);
    vi.mocked(createCaptainRequest).mockResolvedValue(createdState);
    vi.mocked(updatePreferences).mockImplementation(async ({ requestIds, playerId }) => ({
      ...createdState,
      availability: requestIds.map((requestId, index) => ({ requestId, playerId, rank: index + 1, enteredAt: referenceDate.toISOString() })),
    }));
    vi.mocked(runTestingDraw).mockResolvedValue(resultsFixture);
  });

  test('shows Barrie Ultimate branding and the active league name', async () => {
    render(<SubLotteryApp />);

    expect(screen.getByRole('img', { name: 'Barrie Ultimate League' })).toHaveAttribute('src', '/barrie-ultimate-logo.jpg');
    expect(screen.getByText('Barrie Ultimate League')).toBeInTheDocument();
    expect(await screen.findByText('Summer Outdoor 2026')).toBeInTheDocument();
  });

  test('explains the complete lottery process from the header', async () => {
    render(<SubLotteryApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Learn how the sub lottery works' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The sub lottery, in simple terms' })).toBeInTheDocument();
    expect(screen.getByText('Captains add their sub needs')).toBeInTheDocument();
    expect(screen.getByText('Subs enter and rank games')).toBeInTheDocument();
    expect(screen.getByText('The lottery runs')).toBeInTheDocument();
    expect(screen.getByText('Winners are assigned and notified')).toBeInTheDocument();
    expect(screen.getByText(/no response is required/i)).toBeInTheDocument();
  });

  test('runs the complete testing workflow with selectable dummy captains and players', async () => {
    render(<SubLotteryApp />);

    const testingToggle = screen.getByRole('button', { name: 'Testing off' });
    expect(testingToggle).toHaveAttribute('aria-pressed', 'false');

    await act(async () => fireEvent.click(testingToggle));

    expect(loadTestingWeek).toHaveBeenCalledWith();
    expect(screen.getByRole('button', { name: 'Testing on' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Testing week of .* saved separately in Firebase/)).toBeInTheDocument();
    expect(screen.getByText(/Firebase testing week: changes are saved week by week/)).toBeInTheDocument();
    expect(screen.getByText('Email samples')).toBeInTheDocument();
    expect(screen.getByText('Winner email')).toBeInTheDocument();
    expect(screen.getByText('CC:')).toBeInTheDocument();
    expect(screen.getAllByText('morgan.lee@example.test').length).toBeGreaterThan(0);
    expect(screen.getByText('No available sub email')).toBeInTheDocument();
    expect(screen.getByText('Captains: add a sub need')).toBeInTheDocument();
    expect(screen.queryByLabelText('Captain PIN')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Dummy captain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run draw and show winners' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Dummy captain'), { target: { value: 'Morgan Lee' } });
    await waitFor(() => expect(screen.getByDisplayValue('Blue Team')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Open matching sub/));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add sub need' })));

    expect(createCaptainRequest).toHaveBeenCalledWith(expect.objectContaining({
      seasonId: expect.stringMatching(/^testing-/),
      captainPin: 'testing',
      scheduleEntryId: expect.stringContaining('testing-game-1'),
      pool: 'open',
    }));

    fireEvent.click(screen.getByRole('button', { name: /^Subs enter/ }));
    expect(screen.getByText('Sub players: join a draw')).toBeInTheDocument();
    const playerSelect = screen.getByRole('combobox', { name: 'Dummy player' });
    expect(playerSelect.querySelectorAll('option')).toHaveLength(21);
    fireEvent.change(playerSelect, { target: { value: 'Owen Orange' } });
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Enter lottery' })[0]!));

    expect(updatePreferences).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run draw and show winners' })).toBeEnabled());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run draw and show winners' })));

    expect(runTestingDraw).toHaveBeenCalledWith(expect.objectContaining({ seasonId: expect.stringMatching(/^testing-/) }));
    expect(screen.getByText('Lottery results are posted')).toBeInTheDocument();
    expect(screen.getByText('Testing draw completed and winners were saved to Firebase.')).toBeInTheDocument();
  });
});
