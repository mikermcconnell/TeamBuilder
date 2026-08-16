import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadTestingWeek, runTestingDraw, updatePreferences } from '@/sub-lottery/api';
import { SubLotteryApp } from '@/sub-lottery/SubLotteryApp';
import { getPersistedSubLotteryTestingFixture } from '@/sub-lottery/testingFixtures';
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
    vi.mocked(loadTestingWeek).mockResolvedValue(playerFixture);
    vi.mocked(updatePreferences).mockImplementation(async ({ requestIds, playerId }) => ({
      ...playerFixture,
      availability: requestIds.map((requestId, index) => ({ requestId, playerId, rank: index + 1, enteredAt: referenceDate.toISOString() })),
    }));
    vi.mocked(runTestingDraw).mockResolvedValue(resultsFixture);
  });

  test('loads a saved Firebase testing week, accepts an entry, and manually runs the draw', async () => {
    render(<SubLotteryApp />);

    const testingToggle = screen.getByRole('button', { name: 'Testing off' });
    expect(testingToggle).toHaveAttribute('aria-pressed', 'false');

    await act(async () => fireEvent.click(testingToggle));

    expect(loadTestingWeek).toHaveBeenCalledWith();
    expect(screen.getByRole('button', { name: 'Testing on' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Testing week of .* saved separately in Firebase/)).toBeInTheDocument();
    expect(screen.getByText(/Firebase testing week: changes are saved week by week/)).toBeInTheDocument();
    expect(screen.getByText('Sub players: join a draw')).toBeInTheDocument();
    expect(document.querySelectorAll('#sub-player-suggestions option')).toHaveLength(20);
    expect(screen.getAllByText('0 in lottery')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Run draw and show winners' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Pick your name'), { target: { value: 'Owen Orange' } });
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Enter lottery' })[0]!));

    expect(updatePreferences).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run draw and show winners' })).toBeEnabled());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run draw and show winners' })));

    expect(runTestingDraw).toHaveBeenCalledWith(expect.objectContaining({ seasonId: expect.stringMatching(/^testing-/) }));
    expect(screen.getByText('Lottery results are posted')).toBeInTheDocument();
    expect(screen.getByText('Testing draw completed and winners were saved to Firebase.')).toBeInTheDocument();
  });
});
