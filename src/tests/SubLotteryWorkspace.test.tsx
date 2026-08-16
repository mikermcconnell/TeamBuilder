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
      id: 'week-1-2026-06-24-morgan-red-team-friday-9-pm',
      weekLabel: 'Week 1',
      gameDate: '2026-06-24',
      captainName: 'Morgan',
      teamName: 'Red Team',
      gameLabel: 'Friday 9 PM',
      pool: 'open',
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
    render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    expect(screen.getByText('Are you a sub or a captain?')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: "This week's timeline" })).toBeInTheDocument();
    expect(screen.queryByText('Part 3 · Results')).not.toBeInTheDocument();
    expect(screen.getByText('Captains: add a sub need')).toBeInTheDocument();
    expect(screen.queryByText('Sub players: join a draw')).not.toBeInTheDocument();
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

    expect(screen.getByLabelText('Scheduled game')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Blue Team · Friday 8 PM' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Scheduled game'), { target: { value: 'week-1-2026-06-24-morgan-blue-team-friday-8-pm' } });

    expect(screen.getByDisplayValue('Blue Team')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Friday 8 PM')).toBeInTheDocument();
    expect(screen.getByText(/Open and female matching requests are available for every scheduled game/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Open matching sub/)).not.toBeChecked();
    expect(screen.getByLabelText(/Female matching sub/)).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/Open matching sub/));
    expect(screen.queryByText(/does not match the scheduled game pool/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Number of subs needed'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add sub need' }));

    expect(onCreateRequest).toHaveBeenCalledWith({
      captainPin: '1234',
      scheduleEntryId: 'week-1-2026-06-24-morgan-blue-team-friday-8-pm',
      pool: 'open',
      slotsNeeded: 2,
    });
  });

  test('lets captains cancel open requests before the draw with a PIN', () => {
    const onCancelRequest = vi.fn();

    render(<SubLotteryWorkspace state={state} onCancelRequest={onCancelRequest} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    fireEvent.change(screen.getByLabelText('Captain PIN'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));

    expect(onCancelRequest).toHaveBeenCalledWith({ requestId: 'req-1', captainPin: '1234' });
  });


  test('shows draw and results as one timeline step', () => {
    render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    expect(screen.getAllByText('Drawn results').length).toBeGreaterThan(0);
    expect(screen.queryByText('Results shared')).not.toBeInTheDocument();
  });


  test('pins the sticky week timeline at the top of the workspace', () => {
    render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    const roleStart = screen.getByText('Part 1 · Start here');
    const weekTimeline = screen.getByRole('region', { name: "This week's timeline" });

    expect(weekTimeline.compareDocumentPosition(roleStart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(weekTimeline).toHaveClass('sticky');
    expect(screen.getByText("This week's timeline")).toBeInTheDocument();
    expect(screen.queryByText('Sub players: join a draw')).not.toBeInTheDocument();
  });

  test('only shows Part 3 results after the Monday draw until Monday ends', () => {
    const { rerender } = render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-22T15:59:00.000Z')} />);
    expect(screen.queryByText('Part 3 · Results')).not.toBeInTheDocument();
    expect(screen.queryByText('Lottery results are posted')).not.toBeInTheDocument();

    rerender(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-22T16:02:00.000Z')} />);
    expect(screen.getByText('Lottery results are posted')).toBeInTheDocument();
    expect(screen.getByText('Part 3 · Draw complete')).toBeInTheDocument();
    expect(screen.getByText('Part 3 · Results')).toBeInTheDocument();
    expect(screen.queryByText('Part 1 · Start here')).not.toBeInTheDocument();
    expect(screen.queryByText('Sub players: your entry window is closed')).not.toBeInTheDocument();

    rerender(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-23T04:01:00.000Z')} />);
    expect(screen.queryByText('Part 3 · Results')).not.toBeInTheDocument();
  });

});



