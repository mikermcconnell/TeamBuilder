import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceManager } from '@/components/WorkspaceManager';
import type { LeagueConfig, Player, TeamIteration } from '@/types';

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

const saveWorkspaceMock = vi.hoisted(() => vi.fn());
const deleteWorkspaceMock = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: toastMocks,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', email: 'user@example.com' },
  }),
}));

vi.mock('@/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    savedWorkspaces: [],
    saveWorkspace: saveWorkspaceMock,
    deleteWorkspace: deleteWorkspaceMock,
    workspaceName: 'Autosave Smoke Test 2026-04-19',
    workspaceDescription: 'Live Firebase autosave verification',
    currentWorkspaceId: 'workspace-1',
    isSaving: false,
  }),
}));

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
};

const scenario: TeamIteration = {
  id: 'manual-1',
  name: 'Manual 1',
  type: 'manual',
  status: 'ready',
  teams: [],
  unassignedPlayers: [],
  createdAt: '2026-04-19T12:00:00.000Z',
};

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

describe('WorkspaceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveWorkspaceMock.mockResolvedValue({ id: 'workspace-1', type: 'cloud' });
  });

  it('quick saves the current workspace from the toolbar', async () => {
    render(
      <WorkspaceManager
        players={[createPlayer({ id: 'player-1', name: 'Alex Example', isHandler: true })]}
        playerGroups={[]}
        teams={[]}
        unassignedPlayers={[]}
        config={config}
        teamIterations={[scenario]}
        activeTeamIterationId="manual-1"
        onLoadWorkspace={vi.fn()}
        currentWorkspaceId="workspace-1"
        mode="toolbar"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Now' }));

    await waitFor(() => {
      expect(saveWorkspaceMock).toHaveBeenCalledWith(expect.objectContaining({
        players: [expect.objectContaining({ id: 'player-1', isHandler: true })],
        teams: [],
        teamIterations: [expect.objectContaining({ id: 'manual-1' })],
        activeTeamIterationId: 'manual-1',
      }), expect.objectContaining({
        id: 'workspace-1',
        name: 'Autosave Smoke Test 2026-04-19',
        description: 'Live Firebase autosave verification',
      }));
    });
  });

  it('shows the active project name and saves a renamed duplicate with all scenarios', async () => {
    render(
      <WorkspaceManager
        players={[createPlayer({ id: 'player-1', name: 'Alex Example' })]}
        playerGroups={[]}
        teams={[]}
        unassignedPlayers={[]}
        config={config}
        teamIterations={[scenario]}
        activeTeamIterationId="manual-1"
        onLoadWorkspace={vi.fn()}
        currentWorkspaceId="workspace-1"
        mode="toolbar"
      />
    );

    expect(screen.getByText('Current Project')).toBeInTheDocument();
    expect(screen.getByText('Autosave Smoke Test 2026-04-19')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('dialog', { name: 'Save New Project' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Autosave Smoke Test 2026-04-19 (copy)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Project' }));

    await waitFor(() => {
      expect(saveWorkspaceMock).toHaveBeenCalledWith(expect.objectContaining({
        players: [expect.objectContaining({ id: 'player-1' })],
        teamIterations: [expect.objectContaining({ id: 'manual-1' })],
        activeTeamIterationId: 'manual-1',
      }), expect.objectContaining({
        id: null,
        name: 'Autosave Smoke Test 2026-04-19 (copy)',
        description: 'Live Firebase autosave verification',
      }));
    });
  });
});
