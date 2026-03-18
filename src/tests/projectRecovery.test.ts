import { describe, expect, it } from 'vitest';

import { AppState } from '@/types';
import {
  createProjectBackup,
  getProjectBackupFilename,
  parseProjectBackup,
  serializeProjectBackup,
} from '@/utils/projectRecovery';

const appState: AppState = {
  players: [
    {
      id: 'player-1',
      name: 'Alex Example',
      gender: 'M',
      skillRating: 7,
      execSkillRating: 7.5,
      teammateRequests: [],
      avoidRequests: [],
    },
  ],
  teams: [],
  unassignedPlayers: [],
  playerGroups: [],
  config: {
    id: 'config-1',
    name: 'League Config',
    maxTeamSize: 12,
    minFemales: 3,
    minMales: 3,
    allowMixedGender: true,
  },
  execRatingHistory: {
    'alex example': {
      rating: 7.5,
      updatedAt: 123,
    },
  },
  savedConfigs: [],
};

describe('projectRecovery', () => {
  it('creates a full project backup with metadata', () => {
    const backup = createProjectBackup(appState, {
      currentWorkspaceId: 'workspace-1',
      workspaceName: 'Spring League',
      workspaceDescription: 'Current working draft',
    });

    expect(backup).toEqual(
      expect.objectContaining({
        format: 'team-builder-project-backup',
        version: 1,
        project: expect.objectContaining({
          name: 'Spring League',
          description: 'Current working draft',
          sourceWorkspaceId: 'workspace-1',
        }),
        data: appState,
      })
    );
  });

  it('round-trips a serialized backup cleanly', () => {
    const json = serializeProjectBackup(appState, {
      currentWorkspaceId: null,
      workspaceName: 'Recovery Copy',
      workspaceDescription: '',
    });

    const parsed = parseProjectBackup(json);

    expect(parsed.project.name).toBe('Recovery Copy');
    expect(parsed.data.players[0]?.name).toBe('Alex Example');
    expect(parsed.data.config.name).toBe('League Config');
  });

  it('rejects unsupported backup files', () => {
    expect(() => parseProjectBackup(JSON.stringify({ hello: 'world' }))).toThrow(
      'This file is not a supported TeamBuilder project backup.'
    );
  });

  it('builds a safe download filename', () => {
    expect(getProjectBackupFilename('Spring League 2026')).toMatch(/^spring-league-2026-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
