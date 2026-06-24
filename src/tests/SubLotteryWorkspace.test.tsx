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
    },
  ],
  availability: [],
};

describe('SubLotteryWorkspace', () => {
  test('shows a friendly captain and sub landing page', () => {
    render(<SubLotteryWorkspace state={state} />);

    expect(screen.getByText('Sub Squad')).toBeInTheDocument();
    expect(screen.getByText('Need a sub?')).toBeInTheDocument();
    expect(screen.getByText('Want to play?')).toBeInTheDocument();
    expect(screen.getAllByText('Green Team').length).toBeGreaterThan(0);
  });

  test('lets a sub pick their name and enter an open matching pool request', () => {
    const onMarkAvailable = vi.fn();

    render(<SubLotteryWorkspace state={state} onMarkAvailable={onMarkAvailable} />);

    fireEvent.change(screen.getByLabelText('Pick your name'), { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: 'I can play' }));

    expect(onMarkAvailable).toHaveBeenCalledWith('req-1', 'alice');
  });

  test('lets a captain create a female matching request', () => {
    const onCreateRequest = vi.fn();

    render(<SubLotteryWorkspace state={state} onCreateRequest={onCreateRequest} />);

    fireEvent.change(screen.getByLabelText('Captain PIN'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Captain name'), { target: { value: 'Morgan' } });
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Blue Team' } });
    fireEvent.change(screen.getByLabelText('Game time'), { target: { value: 'Friday 8 PM' } });
    fireEvent.click(screen.getByLabelText('Female matching'));
    fireEvent.click(screen.getByRole('button', { name: 'Open 2-hour lottery' }));

    expect(onCreateRequest).toHaveBeenCalledWith({
      captainPin: '1234',
      captainName: 'Morgan',
      teamName: 'Blue Team',
      gameLabel: 'Friday 8 PM',
      pool: 'female',
    });
  });
});

