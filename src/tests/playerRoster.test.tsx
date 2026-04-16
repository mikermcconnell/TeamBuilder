import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Player } from '@/types';
import { PlayerRoster } from '@/components/PlayerRoster';
import { getUserRosters } from '@/services/rosterService';

vi.mock('@/config/firebase', () => ({
  auth: {
    currentUser: { uid: 'user-1' },
  },
}));

vi.mock('@/services/rosterService', () => ({
  getUserRosters: vi.fn(),
}));

describe('PlayerRoster', () => {
  it('renders legacy players even when request arrays are missing', () => {
    vi.mocked(getUserRosters).mockResolvedValue([]);

    const legacyPlayer = {
      id: 'player-1',
      name: 'Legacy Player',
      gender: 'M',
      skillRating: 5,
      execSkillRating: null,
    } as Player;

    render(
      <PlayerRoster
        players={[legacyPlayer]}
        onPlayerUpdate={vi.fn()}
        onPlayerAdd={vi.fn()}
        onPlayerRemove={vi.fn()}
        onClearExecRankings={vi.fn()}
        onResetExecHistory={vi.fn()}
        execHistoryCount={0}
        pendingWarnings={[]}
        onResolveWarning={vi.fn()}
        onDismissWarning={vi.fn()}
        onDismissAllWarnings={vi.fn()}
      />
    );

    expect(screen.getByText('Legacy Player')).toBeInTheDocument();
    expect(screen.getByText('Total Athletes')).toBeInTheDocument();
  });

  it('lets the user toggle the new-player badge', () => {
    vi.mocked(getUserRosters).mockResolvedValue([]);

    const onPlayerUpdate = vi.fn();
    const player = {
      id: 'player-2',
      name: 'Fresh Face',
      gender: 'F',
      skillRating: 6,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
      isNewPlayer: false,
    } as Player;

    render(
      <PlayerRoster
        players={[player]}
        onPlayerUpdate={onPlayerUpdate}
        onPlayerAdd={vi.fn()}
        onPlayerRemove={vi.fn()}
        onClearExecRankings={vi.fn()}
        onResetExecHistory={vi.fn()}
        execHistoryCount={0}
        pendingWarnings={[]}
        onResolveWarning={vi.fn()}
        onDismissWarning={vi.fn()}
        onDismissAllWarnings={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /returning/i }));

    expect(onPlayerUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'player-2',
      isNewPlayer: true,
    }));
  });

  it('shows a neutral badge when new-player status has not been reviewed yet', () => {
    vi.mocked(getUserRosters).mockResolvedValue([]);

    const onPlayerUpdate = vi.fn();
    const player = {
      id: 'player-3',
      name: 'Needs Review',
      gender: 'F',
      skillRating: 6,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
    } as Player;

    render(
      <PlayerRoster
        players={[player]}
        onPlayerUpdate={onPlayerUpdate}
        onPlayerAdd={vi.fn()}
        onPlayerRemove={vi.fn()}
        onClearExecRankings={vi.fn()}
        onResetExecHistory={vi.fn()}
        execHistoryCount={0}
        pendingWarnings={[]}
        onResolveWarning={vi.fn()}
        onDismissWarning={vi.fn()}
        onDismissAllWarnings={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /new\?/i }));

    expect(onPlayerUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'player-3',
      isNewPlayer: true,
    }));
  });

  it('checks historical rosters when adding a player manually', async () => {
    vi.mocked(getUserRosters).mockResolvedValue([
      {
        id: 'roster-1',
        userId: 'user-1',
        name: 'Past Season',
        players: [
          {
            id: 'hist-1',
            name: 'Returning Player',
            gender: 'M',
            skillRating: 6,
            execSkillRating: null,
            teammateRequests: [],
            avoidRequests: [],
            email: 'returning@example.com',
          },
        ],
        version: 1,
      },
    ] as never);

    const onPlayerAdd = vi.fn();

    render(
      <PlayerRoster
        players={[]}
        onPlayerUpdate={vi.fn()}
        onPlayerAdd={onPlayerAdd}
        onPlayerRemove={vi.fn()}
        onClearExecRankings={vi.fn()}
        onResetExecHistory={vi.fn()}
        execHistoryCount={0}
        pendingWarnings={[]}
        onResolveWarning={vi.fn()}
        onDismissWarning={vi.fn()}
        onDismissAllWarnings={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /add player/i })[0]!);
    fireEvent.change(screen.getByPlaceholderText('Enter player name'), { target: { value: 'Returning Player' } });
    fireEvent.change(screen.getByPlaceholderText('player@example.com'), { target: { value: 'returning@example.com' } });
    fireEvent.click(screen.getAllByRole('button', { name: /add player/i }).at(-1)!);

    await waitFor(() => {
      expect(onPlayerAdd).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Returning Player',
        isNewPlayer: false,
      }));
    });
  });
});
