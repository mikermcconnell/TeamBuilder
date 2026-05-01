import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SavedWorkspace } from '@/types';

const serviceMocks = vi.hoisted(() => {
  let subscriptionCallback: ((workspace: SavedWorkspace | null) => void) | null = null;

  return {
    getUserWorkspaces: vi.fn(),
    getWorkspace: vi.fn(),
    saveWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    touchWorkspacePresence: vi.fn(),
    getCurrentSessionId: vi.fn(() => 'current-session'),
    getActiveEditorConflict: vi.fn(() => null),
    subscribeWorkspace: vi.fn((_id: string, _userId: string, onWorkspace: (workspace: SavedWorkspace | null) => void) => {
      subscriptionCallback = onWorkspace;
      return vi.fn();
    }),
    emitWorkspace: (workspace: SavedWorkspace | null) => subscriptionCallback?.(workspace),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', email: 'test@example.com' },
  }),
}));

vi.mock('@/services/workspaceService', () => ({
  WorkspaceService: serviceMocks,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';

const workspace: SavedWorkspace = {
  id: 'workspace-1',
  userId: 'user-123',
  name: 'League Project',
  description: '',
  players: [],
  playerGroups: [],
  config: {
    id: 'config-1',
    name: 'Config',
    maxTeamSize: 7,
    minFemales: 1,
    minMales: 1,
    allowMixedGender: true,
  },
  teams: [],
  unassignedPlayers: [],
  execRatingHistory: {},
  savedConfigs: [],
  teamIterations: [],
  activeTeamIterationId: null,
  leagueMemory: [],
  pendingWarnings: [],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  revision: 1,
  version: 1,
};

function Harness() {
  const workspaceContext = useWorkspace();

  return (
    <div>
      <div data-testid="conflict-reason">
        {workspaceContext.lastWorkspaceConflict?.conflict?.reason ?? 'none'}
      </div>
      <button type="button" onClick={() => void workspaceContext.loadWorkspace('workspace-1')}>
        Load
      </button>
      <button type="button" onClick={() => void workspaceContext.saveWorkspace({}, { id: 'workspace-1', name: 'League Project' })}>
        Save
      </button>
    </div>
  );
}

describe('WorkspaceContext presence handling', () => {
  it('does not advance the local expected revision when another editor saves remotely', async () => {
    serviceMocks.getUserWorkspaces.mockResolvedValue([workspace]);
    serviceMocks.getWorkspace.mockResolvedValue(workspace);
    serviceMocks.saveWorkspace.mockResolvedValue({ id: 'workspace-1', type: 'conflict' });
    serviceMocks.touchWorkspacePresence.mockResolvedValue(undefined);

    render(
      <WorkspaceProvider>
        <Harness />
      </WorkspaceProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => {
      expect(serviceMocks.subscribeWorkspace).toHaveBeenCalled();
    });

    act(() => {
      serviceMocks.emitWorkspace({
        ...workspace,
        revision: 2,
        lastEditedBySession: 'other-session',
      });
    });

    expect(screen.getByTestId('conflict-reason')).toHaveTextContent('revision');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(serviceMocks.saveWorkspace).toHaveBeenCalled();
    });

    expect(serviceMocks.saveWorkspace).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({
        id: 'workspace-1',
        expectedRevision: 1,
      })
    );
  });
});
