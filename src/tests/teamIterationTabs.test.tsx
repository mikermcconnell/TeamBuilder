import { fireEvent, render, screen } from '@testing-library/react';
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

describe('TeamIterationTabs', () => {
  it('calls the delete handler for the selected tab action', () => {
    const onDeleteIteration = vi.fn();

    render(
      <TeamIterationTabs
        iterations={iterations}
        activeIterationId="manual-1"
        onSelectIteration={vi.fn()}
        onCopyIteration={vi.fn()}
        onDeleteIteration={onDeleteIteration}
        onAddManualIteration={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Manual 1' }));

    expect(onDeleteIteration).toHaveBeenCalledWith('manual-1');
  });
});
