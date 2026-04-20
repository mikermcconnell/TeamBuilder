import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Player } from '@/types';
import { PlayerRoster } from '@/components/PlayerRoster';

describe('PlayerRoster', () => {
  it('renders legacy players even when request arrays are missing', () => {
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
});
