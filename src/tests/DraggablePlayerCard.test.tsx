import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

import { DraggablePlayerCard } from '@/components/DraggablePlayerCard';
import type { Player } from '@/types';

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Alex Example',
    gender: 'M',
    skillRating: 7,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

describe('DraggablePlayerCard', () => {
  it('shows a Young badge for players in the young age band', () => {
    render(<DraggablePlayerCard player={createPlayer({ age: 21 })} />);

    expect(screen.getByText('Young')).toBeInTheDocument();
  });

  it('shows a Wise badge for players in the wise age band', () => {
    render(<DraggablePlayerCard player={createPlayer({ age: 44 })} />);

    expect(screen.getByText('Wise')).toBeInTheDocument();
  });

  it('does not show an age badge for standard ages', () => {
    render(<DraggablePlayerCard player={createPlayer({ age: 30 })} />);

    expect(screen.queryByText('Young')).not.toBeInTheDocument();
    expect(screen.queryByText('Wise')).not.toBeInTheDocument();
  });

  it('lets the user toggle new-player status from compact team cards', () => {
    vi.useFakeTimers();
    const onPlayerUpdate = vi.fn();

    render(
      <DraggablePlayerCard
        player={createPlayer()}
        compact
        onPlayerUpdate={onPlayerUpdate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /new-player status: unreviewed/i }));
    vi.runAllTimers();

    expect(onPlayerUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'player-1',
      isNewPlayer: false,
    }), { persistImmediately: true });

    vi.useRealTimers();
  });

  it('uses a denser compact layout with a single metadata row', () => {
    render(
      <DraggablePlayerCard
        player={createPlayer({ age: 44, isNewPlayer: false })}
        compact
        onPlayerUpdate={vi.fn()}
      />
    );

    expect(screen.getByTestId('draggable-player-card')).toHaveClass('px-1.5', 'py-1', 'gap-1.5');
    expect(screen.getByTestId('compact-player-meta')).toHaveTextContent('RET');
    expect(screen.getByTestId('compact-player-meta')).toHaveTextContent('Wise');
  });
});
