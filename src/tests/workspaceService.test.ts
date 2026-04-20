import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCollection,
  mockDeleteDoc,
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockQuery,
  mockServerTimestamp,
  mockSetDoc,
  MockTimestamp,
  mockWhere,
} = vi.hoisted(() => {
  let generatedId = 0;

  return {
    mockCollection: vi.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
    mockDeleteDoc: vi.fn(),
    mockDoc: vi.fn((...args: unknown[]) => {
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && 'kind' in args[0]) {
        generatedId += 1;
        const collection = args[0] as { name: string };
        return { id: `generated-${generatedId}`, path: `${collection.name}/generated-${generatedId}` };
      }

      const [, collectionName, id] = args as [unknown, string, string];
      return { id, path: `${collectionName}/${id}` };
    }),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockQuery: vi.fn((...args: unknown[]) => ({ kind: 'query', args })),
    mockServerTimestamp: vi.fn(() => ({ kind: 'server-timestamp' })),
    mockSetDoc: vi.fn(),
    MockTimestamp: class MockTimestamp {
      constructor(private readonly iso: string) {}
      toDate() {
        return new Date(this.iso);
      }
    },
    mockWhere: vi.fn((...args: unknown[]) => ({ kind: 'where', args })),
  };
});

vi.mock('@/config/firebase', () => ({
  db: { kind: 'mock-db' },
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  serverTimestamp: mockServerTimestamp,
  setDoc: mockSetDoc,
  Timestamp: MockTimestamp,
  where: mockWhere,
}));

import { WorkspaceService } from '@/services/workspaceService';
import type { LeagueConfig, Player, SavedWorkspace } from '@/types';

const config: LeagueConfig = {
  id: 'league-config',
  name: 'Winter League',
  maxTeamSize: 12,
  minFemales: 3,
  minMales: 3,
  allowMixedGender: true,
  targetTeams: 4,
};

const player: Player = {
  id: 'player-1',
  name: 'Alex Example',
  isNewPlayer: false,
  gender: 'M',
  skillRating: 7,
  execSkillRating: 7.5,
  teammateRequests: [],
  avoidRequests: [],
};

function createWorkspace(overrides: Partial<SavedWorkspace> = {}): SavedWorkspace {
  return {
    id: 'workspace-1',
    userId: 'user-123',
    name: 'Project Alpha',
    description: 'Original project',
    players: [player],
    playerGroups: [],
    config,
    teams: [],
    unassignedPlayers: [player],
    stats: undefined,
    execRatingHistory: {},
    savedConfigs: [],
    teamIterations: [],
    activeTeamIterationId: null,
    leagueMemory: [],
    pendingWarnings: [],
    createdAt: '2026-03-18T10:00:00.000Z',
    updatedAt: '2026-03-18T10:00:00.000Z',
    revision: 0,
    version: 1,
    ...overrides,
  };
}

function readLocalWorkspaces(userId = 'user-123'): SavedWorkspace[] {
  const saved = localStorage.getItem(`local_saved_workspaces:${userId}`);
  return saved ? (JSON.parse(saved) as SavedWorkspace[]) : [];
}

describe('WorkspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('saves a new project to cloud storage and mirrors it locally', async () => {
    const result = await WorkspaceService.saveWorkspace({
      userId: 'user-123',
      name: 'Project Alpha',
      description: 'Brand new project',
      players: [player],
      playerGroups: [],
      config,
      teams: [],
      unassignedPlayers: [player],
      version: 1,
    });

    expect(result.type).toBe('cloud');
    expect(result.id).toBe('generated-1');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-1', path: 'workspaces/generated-1' }),
      expect.objectContaining({
        id: 'generated-1',
        userId: 'user-123',
        name: 'Project Alpha',
        description: 'Brand new project',
      }),
      { merge: true }
    );

    const [savedWorkspace] = readLocalWorkspaces();
    expect(savedWorkspace).toEqual(
      expect.objectContaining({
        id: 'generated-1',
        userId: 'user-123',
        name: 'Project Alpha',
      })
    );
    expect(savedWorkspace?.createdAt).toBeTruthy();
    expect(savedWorkspace?.updatedAt).toBeTruthy();
  });

  it('updates an existing project while preserving its original created date', async () => {
    const existingWorkspace = createWorkspace();
    localStorage.setItem('local_saved_workspaces:user-123', JSON.stringify([existingWorkspace]));

    const result = await WorkspaceService.saveWorkspace(
      {
        userId: existingWorkspace.userId,
        name: 'Project Alpha Revised',
        description: 'Updated project description',
        players: existingWorkspace.players,
        playerGroups: existingWorkspace.playerGroups,
        config: existingWorkspace.config,
        teams: [],
        unassignedPlayers: existingWorkspace.unassignedPlayers,
        version: 1,
      },
      { id: existingWorkspace.id, expectedRevision: existingWorkspace.revision }
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: existingWorkspace.id,
        type: 'cloud',
      })
    );

    const [updatedWorkspace] = readLocalWorkspaces();
    expect(updatedWorkspace).toEqual(
      expect.objectContaining({
        id: existingWorkspace.id,
        name: 'Project Alpha Revised',
        description: 'Updated project description',
        createdAt: existingWorkspace.createdAt,
      })
    );
    expect(updatedWorkspace.updatedAt).not.toBe(existingWorkspace.updatedAt);
  });

  it('falls back to local storage when cloud save fails', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('network unavailable'));

    const result = await WorkspaceService.saveWorkspace(
      {
        userId: 'user-123',
        name: 'Offline Project',
        description: 'Saved during an outage',
        players: [player],
        playerGroups: [],
        config,
        teams: [],
        unassignedPlayers: [player],
        version: 1,
      },
      { id: 'offline-workspace' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'offline-workspace',
        type: 'local',
        error: expect.any(Error),
      })
    );
    expect(readLocalWorkspaces()).toEqual([
      expect.objectContaining({
        id: 'offline-workspace',
        name: 'Offline Project',
      }),
    ]);
  });

  it('still saves to cloud when local workspace cache write fails', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const result = await WorkspaceService.saveWorkspace(
      {
        userId: 'user-123',
        name: 'Cloud First Project',
        description: 'Cloud save should still succeed',
        players: [player],
        playerGroups: [],
        config,
        teams: [],
        unassignedPlayers: [player],
        version: 1,
      },
      { id: 'cloud-first-project' }
    );

    expect(result).toEqual(expect.objectContaining({
      id: 'cloud-first-project',
      type: 'cloud',
      local: expect.objectContaining({
        saved: false,
      }),
      cloud: expect.objectContaining({
        saved: true,
      }),
    }));

    setItemSpy.mockRestore();
  });

  it('detects a revision conflict before overwriting a newer saved project', async () => {
    const newerWorkspace = createWorkspace({
      id: 'workspace-conflict',
      name: 'Newer Project',
      revision: 3,
      updatedAt: '2026-03-18T12:00:00.000Z',
    });
    localStorage.setItem('local_saved_workspaces:user-123', JSON.stringify([newerWorkspace]));

    const result = await WorkspaceService.saveWorkspace(
      {
        userId: 'user-123',
        name: 'Older Editor Save',
        description: 'Should not overwrite',
        players: newerWorkspace.players,
        playerGroups: newerWorkspace.playerGroups,
        config: newerWorkspace.config,
        teams: newerWorkspace.teams,
        unassignedPlayers: newerWorkspace.unassignedPlayers,
        version: 1,
      },
      {
        id: newerWorkspace.id,
        expectedRevision: 2,
      }
    );

    expect(result).toEqual(expect.objectContaining({
      id: 'workspace-conflict',
      type: 'conflict',
      conflict: expect.objectContaining({
        expectedRevision: 2,
        actualRevision: 3,
      }),
    }));
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('preserves new-player review flags in cloud project saves', async () => {
    const result = await WorkspaceService.saveWorkspace(
      {
        userId: 'user-123',
        name: 'Project Alpha',
        description: 'Roster review state',
        players: [player],
        playerGroups: [],
        config,
        teams: [],
        unassignedPlayers: [player],
        version: 1,
      },
      { id: 'workspace-new-player-state' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'workspace-new-player-state',
        type: 'cloud',
      })
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'workspace-new-player-state', path: 'workspaces/workspace-new-player-state' }),
      expect.objectContaining({
        players: [
          expect.objectContaining({
            id: 'player-1',
            isNewPlayer: false,
          }),
        ],
      }),
      { merge: true }
    );
  });

  it('preserves all core roster, group, and team fields in cloud project saves', async () => {
    const detailedPlayer: Player = {
      ...player,
      id: 'player-rich',
      name: 'Rich Player',
      isNewPlayer: true,
      gender: 'F',
      skillRating: 0,
      execSkillRating: 0,
      isHandler: true,
      email: 'rich@example.com',
      teammateRequests: ['Teammate One'],
      avoidRequests: ['Avoid One'],
      profile: {
        age: 18,
        registrationInfo: 'Young player',
      },
      groupId: 'group-1',
      teamId: 'team-1',
    };

    await WorkspaceService.saveWorkspace(
      {
        userId: 'user-123',
        name: 'Comprehensive Save',
        description: 'Full field coverage',
        players: [detailedPlayer],
        playerGroups: [
          {
            id: 'group-1',
            label: 'A',
            color: '#3B82F6',
            playerIds: ['player-rich'],
            players: [detailedPlayer],
          },
        ],
        config,
        teams: [
          {
            id: 'team-1',
            name: 'Blue Jays',
            players: [detailedPlayer],
            averageSkill: 0,
            genderBreakdown: { M: 0, F: 1, Other: 0 },
          },
        ],
        unassignedPlayers: [],
        version: 1,
      },
      { id: 'workspace-full-field-state' }
    );

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'workspace-full-field-state', path: 'workspaces/workspace-full-field-state' }),
      expect.objectContaining({
        players: [
          expect.objectContaining({
            id: 'player-rich',
            isNewPlayer: true,
            gender: 'F',
            skillRating: 0,
            execSkillRating: 0,
            isHandler: true,
            teammateRequests: ['Teammate One'],
            avoidRequests: ['Avoid One'],
            profile: expect.objectContaining({
              age: 18,
            }),
            groupId: 'group-1',
            teamId: 'team-1',
          }),
        ],
        playerGroups: [
          expect.objectContaining({
            id: 'group-1',
            playerIds: ['player-rich'],
          }),
        ],
        teams: [
          expect.objectContaining({
            id: 'team-1',
            players: [expect.objectContaining({ id: 'player-rich' })],
          }),
        ],
      }),
      { merge: true }
    );
  });

  it('reloads a locally saved project after a cloud fallback failure', async () => {
    const offlineWorkspace = createWorkspace({
      id: 'offline-workspace',
      name: 'Offline Project',
      updatedAt: '2026-03-18T12:00:00.000Z',
    });

    localStorage.setItem('local_saved_workspaces:user-123', JSON.stringify([offlineWorkspace]));
    mockGetDoc.mockRejectedValueOnce(new Error('cloud still unavailable'));

    const loadedWorkspace = await WorkspaceService.getWorkspace('offline-workspace', 'user-123');

    expect(loadedWorkspace).toEqual(expect.objectContaining({
      id: offlineWorkspace.id,
      name: offlineWorkspace.name,
      updatedAt: offlineWorkspace.updatedAt,
      revision: offlineWorkspace.revision,
    }));
  });

  it.each([
    {
      caseName: 'prefers the newer local copy',
      cloudUpdatedAt: '2026-03-18T10:00:00.000Z',
      localUpdatedAt: '2026-03-18T12:00:00.000Z',
      expectedName: 'Local Draft',
    },
    {
      caseName: 'prefers the newer cloud copy',
      cloudUpdatedAt: '2026-03-18T14:00:00.000Z',
      localUpdatedAt: '2026-03-18T11:00:00.000Z',
      expectedName: 'Cloud Draft',
    },
  ])('loads the newest version when cloud and local differ: $caseName', async ({ cloudUpdatedAt, localUpdatedAt, expectedName }) => {
    const localWorkspace = createWorkspace({
      id: 'versioned-workspace',
      name: 'Local Draft',
      updatedAt: localUpdatedAt,
    });

    const cloudWorkspace = createWorkspace({
      id: 'versioned-workspace',
      name: 'Cloud Draft',
      updatedAt: cloudUpdatedAt,
    });

    localStorage.setItem('local_saved_workspaces:user-123', JSON.stringify([localWorkspace]));
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => cloudWorkspace,
    });

    const loadedWorkspace = await WorkspaceService.getWorkspace('versioned-workspace', 'user-123');

    expect(loadedWorkspace?.name).toBe(expectedName);
  });

  it('keeps a newly added roster player when the local project is newer than the cloud copy', async () => {
    const originalPlayer: Player = {
      id: 'player-1',
      name: 'Alex Example',
      gender: 'M',
      skillRating: 7,
      execSkillRating: 7.5,
      teammateRequests: [],
      avoidRequests: [],
    };

    const addedPlayer: Player = {
      id: 'player-2',
      name: 'Bailey Builder',
      gender: 'F',
      skillRating: 6,
      execSkillRating: null,
      teammateRequests: [],
      avoidRequests: [],
    };

    const cloudWorkspace = createWorkspace({
      id: 'roster-persistence-workspace',
      updatedAt: '2026-03-18T10:00:00.000Z',
      players: [originalPlayer],
      unassignedPlayers: [originalPlayer],
    });

    const newerLocalWorkspace = createWorkspace({
      id: 'roster-persistence-workspace',
      updatedAt: '2026-03-18T12:00:00.000Z',
      players: [originalPlayer, addedPlayer],
      unassignedPlayers: [originalPlayer, addedPlayer],
    });

    localStorage.setItem('local_saved_workspaces:user-123', JSON.stringify([newerLocalWorkspace]));

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => cloudWorkspace,
    });

    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => cloudWorkspace,
        },
      ],
    });

    const loadedWorkspace = await WorkspaceService.getWorkspace('roster-persistence-workspace', 'user-123');
    const listedWorkspaces = await WorkspaceService.getUserWorkspaces('user-123');

    expect(loadedWorkspace?.players.map(currentPlayer => currentPlayer.name)).toEqual([
      'Alex Example',
      'Bailey Builder',
    ]);
    expect(loadedWorkspace?.unassignedPlayers).toHaveLength(2);

    expect(listedWorkspaces).toHaveLength(1);
    expect(listedWorkspaces[0]?.players.map(currentPlayer => currentPlayer.name)).toEqual([
      'Alex Example',
      'Bailey Builder',
    ]);
  });

  it('keeps local fallback workspaces isolated by user', async () => {
    const userOneWorkspace = createWorkspace({
      id: 'shared-id',
      userId: 'user-123',
      name: 'User One Project',
    });

    const userTwoWorkspace = createWorkspace({
      id: 'shared-id',
      userId: 'user-456',
      name: 'User Two Project',
    });

    localStorage.setItem('local_saved_workspaces:user-123', JSON.stringify([userOneWorkspace]));
    localStorage.setItem('local_saved_workspaces:user-456', JSON.stringify([userTwoWorkspace]));
    mockGetDoc.mockRejectedValue(new Error('cloud unavailable'));

    const userOneLoaded = await WorkspaceService.getWorkspace('shared-id', 'user-123');
    const userTwoLoaded = await WorkspaceService.getWorkspace('shared-id', 'user-456');

    expect(userOneLoaded?.name).toBe('User One Project');
    expect(userTwoLoaded?.name).toBe('User Two Project');
  });

  it('redacts sensitive player fields in the local workspace cache', async () => {
    const sensitivePlayer: Player = {
      ...player,
      id: 'player-sensitive',
      email: 'private@example.com',
      profile: {
        age: 27,
        registrationInfo: 'Sensitive notes',
      },
    };

    await WorkspaceService.saveWorkspace({
      userId: 'user-123',
      name: 'Sanitized Local Cache',
      description: 'Should remove sensitive fields locally',
      players: [sensitivePlayer],
      playerGroups: [],
      config,
      teams: [],
      unassignedPlayers: [sensitivePlayer],
      version: 1,
    }, { id: 'workspace-sanitized' });

    const [savedWorkspace] = readLocalWorkspaces();
    expect(savedWorkspace?.players[0]).toEqual(expect.objectContaining({
      id: 'player-sensitive',
      profile: { age: 27 },
    }));
    expect(savedWorkspace?.players[0]).not.toHaveProperty('email');
    expect(savedWorkspace?.players[0]).not.toHaveProperty('registrationInfo');
  });

  it('prefers cloud ordering based on server timestamps when available', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => createWorkspace({
            id: 'workspace-old',
            name: 'Older by client time',
            updatedAt: '2026-03-18T14:00:00.000Z',
            updatedAtServer: new MockTimestamp('2026-03-18T13:00:00.000Z') as unknown as string,
          }),
        },
        {
          data: () => createWorkspace({
            id: 'workspace-new',
            name: 'Newer by server time',
            updatedAt: '2026-03-18T12:00:00.000Z',
            updatedAtServer: new MockTimestamp('2026-03-18T15:00:00.000Z') as unknown as string,
          }),
        },
      ],
    });

    const workspaces = await WorkspaceService.getUserWorkspaces('user-123');

    expect(workspaces.map(workspace => workspace.id)).toEqual(['workspace-new', 'workspace-old']);
  });
});
