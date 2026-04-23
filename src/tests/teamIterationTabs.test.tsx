import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TeamIterationTabs } from '@/components/TeamIterationTabs';
import type { TeamIteration } from '@/types';

const iterations: TeamIteration[] = [
  {
    id: 'manual-1',
    name: 'Manual 1',
    type: 'manual',
    status: 'ready',
    teams: [],
    unassignedPlayers: [],
    createdAt: '2026-04-21T10:00:00.000Z',
    isPreferred: true,
    note: 'Best balance so far.',
  },
  {
    id: 'manual-2',
    name: 'Manual 2',
    type: 'manual',
    status: 'ready',
    teams: [],
    unassignedPlayers: [],
    createdAt: '2026-04-21T10:01:00.000Z',
  },
];

function renderTabs(props: Partial<ComponentProps<typeof TeamIterationTabs>> = {}) {
  return render(
    <TeamIterationTabs
      iterations={iterations}
      activeIterationId="manual-1"
      onSelectIteration={vi.fn()}
      onCopyIteration={vi.fn()}
      onDeleteIteration={vi.fn()}
      onEditIteration={vi.fn()}
      onMarkPreferred={vi.fn()}
      onMarkFinal={vi.fn()}
      onAddManualIteration={vi.fn()}
      {...props}
    />
  );
}

function openActions(iterationLabel: string) {
  fireEvent.pointerDown(screen.getByRole('button', { name: `More actions for ${iterationLabel}` }), {
    button: 0,
    ctrlKey: false,
  });
}

describe('TeamIterationTabs', () => {
  it('calls the delete handler for the selected tab action', () => {
    const onDeleteIteration = vi.fn();

    renderTabs({ onDeleteIteration });

    openActions('Manual 1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Draft' }));

    expect(onDeleteIteration).toHaveBeenCalledWith('manual-1');
  });

  it('renders Preferred and Note badges', () => {
    renderTabs();

    expect(screen.getByText('Preferred')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('marks a ready draft preferred and final from the action menu', () => {
    const onMarkPreferred = vi.fn();
    const onMarkFinal = vi.fn();

    renderTabs({ onMarkPreferred, onMarkFinal });

    openActions('Manual 2');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark Preferred' }));
    openActions('Manual 2');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark Final' }));

    expect(onMarkPreferred).toHaveBeenCalledWith('manual-2');
    expect(onMarkFinal).toHaveBeenCalledWith('manual-2');
  });

  it('calls the edit handler from the action menu', () => {
    const onEditIteration = vi.fn();

    renderTabs({ onEditIteration });

    openActions('Manual 1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Name & Note' }));

    expect(onEditIteration).toHaveBeenCalledWith('manual-1');
  });
});
