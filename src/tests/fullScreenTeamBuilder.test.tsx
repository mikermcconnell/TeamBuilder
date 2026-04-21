import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FullScreenTeamBuilder } from '@/components/FullScreenTeamBuilder';
import type { LeagueConfig, TeamIteration } from '@/types';

vi.mock('@/components/PlayerSidebar', () => ({
  PlayerSidebar: () => <div data-testid="player-sidebar" />,
}));

vi.mock('@/components/TeamBoard', () => ({
  TeamBoard: () => <div data-testid="team-board" />,
}));

vi.mock('@/components/DraggablePlayerCard', () => ({
  DraggablePlayerCard: () => <div data-testid="draggable-player-card" />,
}));

vi.mock('@/components/TeamIterationTabs', () => ({
  TeamIterationTabs: () => <div data-testid="team-iteration-tabs" />,
}));

vi.mock('@/components/WorkspaceManager', () => ({
  WorkspaceManager: () => <div data-testid="workspace-manager" />,
}));

vi.mock('@/components/teams/ManualEditAssist', () => ({
  ManualEditAssist: () => <div data-testid="manual-edit-assist" />,
}));

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
  targetTeams: 2,
};

const iteration: TeamIteration = {
  id: 'manual-1',
  name: 'Manual 1',
  type: 'manual',
  status: 'ready',
  teams: [],
  unassignedPlayers: [],
  createdAt: '2026-04-21T10:00:00.000Z',
};

function renderWorkspace(overrides?: Partial<ComponentProps<typeof FullScreenTeamBuilder>>) {
  return render(
    <FullScreenTeamBuilder
      teams={[]}
      unassignedPlayers={[]}
      config={config}
      onPlayerMove={vi.fn()}
      onPlayerUpdate={vi.fn()}
      onTeamNameChange={vi.fn()}
      players={[]}
      playerGroups={[]}
      onLoadWorkspace={vi.fn()}
      iterations={[iteration]}
      activeIterationId={iteration.id}
      onSelectIteration={vi.fn()}
      onCopyIteration={vi.fn()}
      onDeleteIteration={vi.fn()}
      onRenameIteration={vi.fn()}
      onAddManualIteration={vi.fn()}
      onUndo={vi.fn()}
      canUndo
      onRedo={vi.fn()}
      canRedo={false}
      {...overrides}
    />
  );
}

describe('FullScreenTeamBuilder redo controls', () => {
  it('renders redo disabled when no redo state is available', () => {
    renderWorkspace({ canRedo: false });

    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('calls the redo handler from the toolbar button', () => {
    const onRedo = vi.fn();
    renderWorkspace({ onRedo, canRedo: true });

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));

    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('fires redo keyboard shortcuts through the same handler', () => {
    const onRedo = vi.fn();
    renderWorkspace({ onRedo, canRedo: true });

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });

    expect(onRedo).toHaveBeenCalledTimes(3);
  });

  it('calls the delete handler from the active draft action', () => {
    const onDeleteIteration = vi.fn();
    renderWorkspace({ onDeleteIteration });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Draft' }));

    expect(onDeleteIteration).toHaveBeenCalledWith(iteration.id);
  });
});
