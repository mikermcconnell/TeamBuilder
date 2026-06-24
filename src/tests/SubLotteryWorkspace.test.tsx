import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { SubLotteryWorkspace } from '@/sub-lottery/SubLotteryWorkspace';
import type { SubLotteryPublicState } from '@/sub-lottery/types';

const state: SubLotteryPublicState = {
  seasonId: 'season-2026',
  seasonName: 'Summer 2026',
  players: [
    { id: 'alice', name: 'Alice Green', pool: 'female', seasonSubCount: 0, active: true },
    { id: 'owen', name: 'Owen Orange', pool: 'open', seasonSubCount: 1, active: true },
  ],
  scheduleEntries: [
    {
      id: 'week-1-2026-06-24-morgan-blue-team-friday-8-pm',
      weekLabel: 'Week 1',
      gameDate: '2026-06-24',
      captainName: 'Morgan',
      teamName: 'Blue Team',
      gameLabel: 'Friday 8 PM',
      pool: 'female',
      active: true,
    },
    {
      id: 'week-2-2026-07-01-casey-green-team-friday-9-pm',
      weekLabel: 'Week 2',
      gameDate: '2026-07-01',
      captainName: 'Casey',
      teamName: 'Green Team',
      gameLabel: 'Friday 9 PM',
      pool: 'open',
      active: true,
    },
  ],
  requests: [
    {
      id: 'req-1',
      seasonId: 'season-2026',
      captainName: 'Captain Casey',
      teamName: 'Green Team',
      gameLabel: 'Thursday 7:00 PM',
      pool: 'female',
      status: 'open',
      openedAt: '2026-06-24T12:00:00.000Z',
      closesAt: '2026-06-24T14:00:00.000Z',
      slotsNeeded: 1,
    },
  ],
  availability: [],
  assignments: [],
};

describe('SubLotteryWorkspace', () => {
  test('shows a friendly captain and sub landing page', () => {
    render(<SubLotteryWorkspace state={state} />);

    expect(screen.getByText('Sub Squad')).toBeInTheDocument();
    expect(screen.getByText('Captains: add a sub need')).toBeInTheDocument();
    expect(screen.getByText('Sub players: join a draw')).toBeInTheDocument();
    expect(screen.getAllByText('Green Team').length).toBeGreaterThan(0);
  });

  test('lets a sub pick their name and enter an open matching pool request', () => {
    const onMarkAvailable = vi.fn();

    render(<SubLotteryWorkspace state={state} onMarkAvailable={onMarkAvailable} currentDate={new Date('2026-06-22T13:00:00.000Z')} />);

    const nameInput = screen.getByLabelText('Pick your name');
    expect(nameInput.tagName).toBe('INPUT');
    expect(nameInput).toHaveAttribute('list', 'sub-player-suggestions');
    expect(document.querySelector('#sub-player-suggestions option[value="Alice Green"]')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Alice Green' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enter lottery' }));

    expect(onMarkAvailable).toHaveBeenCalledWith('req-1', 'alice');
  });

  test('lets a captain select their weekly schedule entry and autofills team and game time', () => {
    const onCreateRequest = vi.fn();

    render(<SubLotteryWorkspace state={state} onCreateRequest={onCreateRequest} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    const captainPinInput = screen.getByLabelText('Captain PIN');
    expect(captainPinInput).toHaveAttribute('type', 'text');
    fireEvent.change(captainPinInput, { target: { value: '1234' } });
    expect(screen.queryByLabelText('Week')).not.toBeInTheDocument();
    expect(screen.getByText('Game week: Week 1')).toBeInTheDocument();
    const captainInput = screen.getByLabelText('Captain name');
    expect(captainInput.tagName).toBe('INPUT');
    expect(captainInput).toHaveAttribute('list', 'captain-name-suggestions');
    expect(document.querySelector('#captain-name-suggestions option[value="Morgan"]')).toBeInTheDocument();

    fireEvent.change(captainInput, { target: { value: 'Morgan' } });

    expect(screen.getByDisplayValue('Blue Team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Friday 8 PM')).toBeInTheDocument();
    expect(screen.getByLabelText(/Open matching sub/)).not.toBeChecked();
    expect(screen.getByLabelText(/Female matching sub/)).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Add sub need' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Open matching sub/));
    fireEvent.change(screen.getByLabelText('Number of subs needed'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add sub need' }));

    expect(onCreateRequest).toHaveBeenCalledWith({
      captainPin: '1234',
      scheduleEntryId: 'week-1-2026-06-24-morgan-blue-team-friday-8-pm',
      pool: 'open',
      slotsNeeded: 2,
    });
  });
});



