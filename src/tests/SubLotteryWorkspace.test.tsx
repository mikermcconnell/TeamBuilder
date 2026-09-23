import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { SubLotteryWorkspace } from '@/sub-lottery/SubLotteryWorkspace';
import type { SubLotteryPublicState } from '@/sub-lottery/types';

vi.mock('@/sub-lottery/api', () => ({
  loadAccessStatus: vi.fn(async () => ({ verified: true })),
  requestAccessCode: vi.fn(async () => ({ sent: true })),
  verifyAccessCode: vi.fn(async () => ({ verified: true })),
}));

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
  test('shows three compact task tabs and defaults to the current phase', () => {
    render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    expect(screen.getByRole('tablist', { name: 'Choose a sub lottery task' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Need a sub' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Can sub' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('Are you a sub or a captain?')).not.toBeInTheDocument();
    expect(screen.queryByText("This week's timeline")).not.toBeInTheDocument();
    expect(screen.getByText('Captains: add a sub need')).toBeInTheDocument();
    expect(screen.queryByText('Sub players: join a draw')).not.toBeInTheDocument();
    expect(screen.getByText('Game week: Week 1')).toBeInTheDocument();
  });

  test('lets a sub pick their name and enter an open matching pool request', async () => {
    const onMarkAvailable = vi.fn();

    render(<SubLotteryWorkspace state={state} onMarkAvailable={onMarkAvailable} currentDate={new Date('2026-06-22T13:00:00.000Z')} />);

    const nameInput = screen.getByLabelText('Pick your name');
    expect(nameInput.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Alice Green · Female matching' })).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'alice' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enter lottery' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Enter lottery' }));

    expect(onMarkAvailable).toHaveBeenCalledWith('req-1', 'alice');
  });

  test('does not require an email code from a sub player', () => {
    render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-22T13:00:00.000Z')} />);
    fireEvent.change(screen.getByLabelText('Pick your name'), { target: { value: 'alice' } });
    expect(screen.queryByText('Verify your player email')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter lottery' })).toBeEnabled();
    expect(screen.getByText(/Your entry and rankings will be saved under that name/)).toBeInTheDocument();
    expect(screen.getByText(/If you win, you are assigned to that game/)).toBeInTheDocument();
  });

  test('lets a verified captain select their weekly schedule entry and autofills team and game time', async () => {
    const onCreateRequest = vi.fn(async () => true);

    render(<SubLotteryWorkspace state={state} onCreateRequest={onCreateRequest} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    const captainPinInput = screen.getByLabelText('Captain PIN');
    expect(captainPinInput).toHaveAttribute('type', 'password');
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
    fireEvent.change(screen.getByLabelText('Number of open matching subs needed'), { target: { value: '2' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add sub need' })).toBeEnabled());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add sub need' })));

    expect(onCreateRequest).toHaveBeenCalledWith(expect.objectContaining({
      captainPin: '1234',
      scheduleEntryId: 'week-1-2026-06-24-morgan-blue-team-friday-8-pm',
      needs: [{ pool: 'open', slotsNeeded: 2 }],
      submissionId: expect.any(String),
    }));
  });

  test('adds open and female matching needs together with separate counts', async () => {
    const onCreateRequest = vi.fn(async () => true);
    const scheduleEntryId = 'week-1-2026-06-24-morgan-blue-team-friday-8-pm';

    render(<SubLotteryWorkspace
      state={state}
      onCreateRequest={onCreateRequest}
      currentDate={new Date('2026-06-21T12:00:00.000Z')}
    />);

    fireEvent.change(screen.getByLabelText('Captain PIN'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Captain name'), { target: { value: 'Morgan' } });
    fireEvent.change(screen.getByLabelText('Scheduled game'), { target: { value: scheduleEntryId } });
    fireEvent.click(screen.getByLabelText(/Open matching sub/));
    fireEvent.click(screen.getByLabelText(/Female matching sub/));
    fireEvent.change(screen.getByLabelText('Number of open matching subs needed'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Number of female matching subs needed'), { target: { value: '3' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add 2 sub needs' })).toBeEnabled());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add 2 sub needs' })));

    expect(onCreateRequest).toHaveBeenCalledWith(expect.objectContaining({
      captainPin: '1234', scheduleEntryId, submissionId: expect.any(String),
      needs: [{ pool: 'open', slotsNeeded: 2 }, { pool: 'female', slotsNeeded: 3 }],
    }));
  });

  test('submits additional slots when a matching need already exists', async () => {
    const onCreateRequest = vi.fn(async () => true);
    const scheduleEntryId = 'week-1-2026-06-24-morgan-blue-team-friday-8-pm';
    const stateWithExistingFemaleNeed: SubLotteryPublicState = {
      ...state,
      requests: [{
        ...state.requests[0]!,
        id: 'existing-female-need',
        captainName: 'Morgan',
        teamName: 'Blue Team',
        scheduleEntryId,
      }],
    };

    render(<SubLotteryWorkspace
      state={stateWithExistingFemaleNeed}
      onCreateRequest={onCreateRequest}
      currentDate={new Date('2026-06-21T12:00:00.000Z')}
    />);

    fireEvent.change(screen.getByLabelText('Captain PIN'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Captain name'), { target: { value: 'Morgan' } });
    fireEvent.change(screen.getByLabelText('Scheduled game'), { target: { value: scheduleEntryId } });
    fireEvent.click(screen.getByLabelText(/Female matching sub/));

    expect(screen.getByLabelText('Number of female matching subs needed')).toHaveValue(1);
    expect(screen.queryByText(/already added/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add sub need' })).toBeEnabled());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add sub need' })));

    expect(onCreateRequest).toHaveBeenCalledWith(expect.objectContaining({
      captainPin: '1234',
      scheduleEntryId,
      needs: [{ pool: 'female', slotsNeeded: 1 }],
      submissionId: expect.any(String),
    }));
  });

  test('confirms cancellation for the verified captain game', async () => {
    const onCancelRequest = vi.fn();
    const ownState = { ...state, requests: [{ ...state.requests[0]!, scheduleEntryId: state.scheduleEntries[0]!.id }] };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SubLotteryWorkspace state={ownState} onCancelRequest={onCancelRequest} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    fireEvent.change(screen.getByLabelText('Captain PIN'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Captain name'), { target: { value: 'Morgan' } });
    fireEvent.change(screen.getByLabelText('Scheduled game'), { target: { value: state.scheduleEntries[0]!.id } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel need' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel need' }));

    expect(onCancelRequest).toHaveBeenCalledWith({ requestId: 'req-1', captainPin: '1234' });
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });


  test('lets users open results before the draw without hiding the other tasks', () => {
    render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Results' }));

    expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByText('Results will appear here after the Monday draw.')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for the draw/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Need a sub' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Can sub' })).toBeInTheDocument();
  });

  test('shows the latest completed draw after the next captain week starts', () => {
    const recentState: SubLotteryPublicState = {
      ...state,
      recentWeekStartDate: '2026-06-22',
      recentRequests: [{ ...state.requests[0]!, id: 'previous-request', weekStartDate: '2026-06-22', status: 'assigned', assignedPlayerIds: ['alice'] }],
    };
    render(<SubLotteryWorkspace state={recentState} currentDate={new Date('2026-06-23T13:00:00.000Z')} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Results' }));
    expect(screen.getByText(/Latest completed draw: week of June 22, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Alice Green won the draw/)).toBeInTheDocument();
  });


  test('pins the compact task navigation at the top of the workspace', () => {
    render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-21T12:00:00.000Z')} />);

    const navigation = screen.getByRole('region', { name: 'Sub lottery navigation' });

    expect(navigation).toHaveClass('sticky');
    expect(screen.getAllByText('Time remaining')).toHaveLength(1);
    expect(screen.queryByText('Sub players: join a draw')).not.toBeInTheDocument();
  });

  test('defaults to Results during the draw window and returns to the captain tab next week', () => {
    const { rerender } = render(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-22T15:59:00.000Z')} />);
    expect(screen.getByRole('tab', { name: 'Can sub' })).toHaveAttribute('aria-selected', 'true');

    rerender(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-22T16:02:00.000Z')} />);
    expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByText('See which subs were assigned after the Monday draw.')).toBeInTheDocument();
    expect(screen.queryByText('Sub players: your entry window is closed')).not.toBeInTheDocument();

    rerender(<SubLotteryWorkspace state={state} currentDate={new Date('2026-06-23T04:01:00.000Z')} />);
    expect(screen.getByRole('tab', { name: 'Need a sub' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Captains: add a sub need')).toBeInTheDocument();
  });

});



