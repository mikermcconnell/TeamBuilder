import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectWorkspaceControls } from '@/components/ProjectWorkspaceControls';
import type { PersistenceStatusModel } from '@/hooks/useAppPersistence';
import type { SavedWorkspace } from '@/types';

const persistenceStatus: PersistenceStatusModel = {
  title: 'Project ready',
  detail: 'Roster, teams, and scenarios will autosave',
  tone: 'neutral',
  icon: 'cloud',
};

const baseProps = {
  user: { uid: 'user-1', email: 'user@example.com' },
  authDialogOpen: false,
  onAuthDialogOpenChange: vi.fn(),
  onSignOut: vi.fn(),
  persistenceStatus,
  importFileInputRef: { current: null },
  onImportProjectBackup: vi.fn(),
  onExportProjectBackup: vi.fn(),
  onOpenProjectImport: vi.fn(),
  onOpenSaveWorkspaceDialog: vi.fn(),
  onOpenLoadWorkspaceDialog: vi.fn(),
  isSaveWorkspaceDialogOpen: true,
  onSaveWorkspaceDialogOpenChange: vi.fn(),
  isLoadWorkspaceDialogOpen: false,
  onLoadWorkspaceDialogOpenChange: vi.fn(),
  workspaceName: 'Original Project',
  workspaceDescription: 'Original description',
  currentWorkspaceId: 'workspace-1',
  currentProjectSummary: {
    playerCount: 134,
    teamCount: 12,
    scenarioCount: 3,
  },
  isSavingWorkspace: false,
  onSaveWorkspace: vi.fn(),
  workspaceConflict: null,
  onReloadWorkspaceAfterConflict: vi.fn(),
  onMergeWorkspaceAfterConflict: vi.fn(),
  onSaveWorkspaceAsCopy: vi.fn(),
  onDismissWorkspaceConflict: vi.fn(),
  workspaceSearchTerm: '',
  onWorkspaceSearchTermChange: vi.fn(),
  isFetchingWorkspaces: false,
  savedWorkspaces: [],
  loadingWorkspaceId: null,
  onLoadWorkspace: vi.fn(),
  onDeleteWorkspaceAction: vi.fn(),
};

function ControlledProjectWorkspaceControls(
  props: Partial<React.ComponentProps<typeof ProjectWorkspaceControls>> = {}
) {
  const [isSaveWorkspaceDialogOpen, setIsSaveWorkspaceDialogOpen] = React.useState(false);

  return (
    <ProjectWorkspaceControls
      {...baseProps}
      isSaveWorkspaceDialogOpen={isSaveWorkspaceDialogOpen}
      onSaveWorkspaceDialogOpenChange={setIsSaveWorkspaceDialogOpen}
      {...props}
    />
  );
}

describe('ProjectWorkspaceControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps renamed project text local until the user saves', async () => {
    const onSaveWorkspace = vi.fn().mockResolvedValue(undefined);

    render(
      <ProjectWorkspaceControls
        {...baseProps}
        onSaveWorkspace={onSaveWorkspace}
      />
    );

    fireEvent.change(screen.getByLabelText('Project Name'), {
      target: { value: 'Renamed Copy' },
    });
    fireEvent.change(screen.getByLabelText('Description (Optional)'), {
      target: { value: 'Copy description' },
    });

    expect(onSaveWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText('Original Project')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onSaveWorkspace).toHaveBeenCalledWith('Renamed Copy', 'Copy description');
    });
  });

  it('uses safer project action labels and explains what save includes', () => {
    const { rerender } = render(
      <ProjectWorkspaceControls
        {...baseProps}
        isSaveWorkspaceDialogOpen={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Download Backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore from Backup' })).toBeInTheDocument();

    rerender(<ProjectWorkspaceControls {...baseProps} />);

    expect(screen.getByText('Rename / Save Project')).toBeInTheDocument();
    expect(screen.getByText('This saves the roster, team scenarios, and settings together.')).toBeInTheDocument();
    expect(screen.getByText('134 players')).toBeInTheDocument();
    expect(screen.getByText('12 teams')).toBeInTheDocument();
    expect(screen.getByText('3 team scenarios')).toBeInTheDocument();
  });

  it('opens duplicate as a save-new-project dialog before creating the copy', async () => {
    const onSaveWorkspace = vi.fn().mockResolvedValue(undefined);
    const onSaveWorkspaceAsCopy = vi.fn().mockResolvedValue(undefined);

    render(
      <ControlledProjectWorkspaceControls
        onSaveWorkspace={onSaveWorkspace}
        onSaveWorkspaceAsCopy={onSaveWorkspaceAsCopy}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(onSaveWorkspaceAsCopy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Save New Project' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original Project (copy)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => {
      expect(onSaveWorkspace).toHaveBeenCalledWith(
        'Original Project (copy)',
        'Original description',
        { asCopy: true }
      );
    });
  });

  it('shows saved project roster, team, scenario, and final draft details in the load dialog', () => {
    const savedWorkspace: SavedWorkspace = {
      id: 'workspace-2',
      userId: 'user-1',
      name: 'Spring League 2026',
      description: 'Outdoor draft',
      players: Array.from({ length: 134 }, (_, index) => ({
        id: `player-${index}`,
        name: `Player ${index}`,
        gender: 'M',
        skillRating: 5,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
      })),
      playerGroups: [],
      config: {
        id: 'config-1',
        name: 'Spring League',
        maxTeamSize: 12,
        minFemales: 3,
        minMales: 3,
        allowMixedGender: true,
      },
      teams: Array.from({ length: 12 }, (_, index) => ({
        id: `team-${index}`,
        name: `Team ${index}`,
        players: [],
        averageSkill: 0,
        genderBreakdown: { M: 0, F: 0, Other: 0 },
      })),
      unassignedPlayers: [],
      execRatingHistory: {},
      savedConfigs: [],
      teamIterations: [
        {
          id: 'ai-1',
          name: 'AI Draft 1',
          type: 'ai',
          status: 'ready',
          teams: [],
          unassignedPlayers: [],
          createdAt: '2026-05-03T10:00:00.000Z',
        },
        {
          id: 'ai-2',
          name: 'AI Draft 2',
          type: 'ai',
          status: 'ready',
          teams: [],
          unassignedPlayers: [],
          createdAt: '2026-05-03T10:05:00.000Z',
          isFinal: true,
        },
      ],
      activeTeamIterationId: 'ai-2',
      leagueMemory: [],
      pendingWarnings: [],
      createdAt: '2026-05-03T10:00:00.000Z',
      updatedAt: '2026-05-03T10:15:00.000Z',
      revision: 2,
      version: 1,
    };

    render(
      <ProjectWorkspaceControls
        {...baseProps}
        isSaveWorkspaceDialogOpen={false}
        isLoadWorkspaceDialogOpen
        savedWorkspaces={[savedWorkspace]}
      />
    );

    expect(screen.getByText('Spring League 2026')).toBeInTheDocument();
    expect(screen.getByText('134 players')).toBeInTheDocument();
    expect(screen.getByText('12 teams')).toBeInTheDocument();
    expect(screen.getByText('2 scenarios')).toBeInTheDocument();
    expect(screen.getByText('Final: AI Draft 2')).toBeInTheDocument();
  });

  it('does not load another project while a project is already loading', () => {
    const onLoadWorkspace = vi.fn().mockResolvedValue(undefined);
    const savedWorkspace: SavedWorkspace = {
      id: 'workspace-2',
      userId: 'user-1',
      name: 'Spring League 2026',
      players: [],
      playerGroups: [],
      config: {
        id: 'config-1',
        name: 'Spring League',
        maxTeamSize: 12,
        minFemales: 3,
        minMales: 3,
        allowMixedGender: true,
      },
      teams: [],
      unassignedPlayers: [],
      execRatingHistory: {},
      savedConfigs: [],
      createdAt: '2026-05-03T10:00:00.000Z',
      updatedAt: '2026-05-03T10:15:00.000Z',
      revision: 2,
      version: 1,
    };

    render(
      <ProjectWorkspaceControls
        {...baseProps}
        isSaveWorkspaceDialogOpen={false}
        isLoadWorkspaceDialogOpen
        loadingWorkspaceId="workspace-1"
        savedWorkspaces={[savedWorkspace]}
        onLoadWorkspace={onLoadWorkspace}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Spring League 2026/ })[0]!);

    expect(onLoadWorkspace).not.toHaveBeenCalled();
  });
});
