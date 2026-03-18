import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCollection,
  mockDeleteDoc,
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockQuery,
  mockSetDoc,
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
    mockSetDoc: vi.fn(),
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
  setDoc: mockSetDoc,
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
    createdAt: '2026-03-18T10:00:00.000Z',
    updatedAt: '2026-03-18T10:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

function readLocalWorkspaces(): SavedWorkspace[] {
  const saved = localStorage.getItem('local_saved_workspaces');
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
    localStorage.setItem('local_saved_workspaces', JSON.stringify([existingWorkspace]));

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
      existingWorkspace.id
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
      'offline-workspace'
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

  it('reloads a locally saved project after a cloud fallback failure', async () => {
    const offlineWorkspace = createWorkspace({
      id: 'offline-workspace',
      name: 'Offline Project',
      updatedAt: '2026-03-18T12:00:00.000Z',
    });

    localStorage.setItem('local_saved_workspaces', JSON.stringify([offlineWorkspace]));
    mockGetDoc.mockRejectedValueOnce(new Error('cloud still unavailable'));

    const loadedWorkspace = await WorkspaceService.getWorkspace('offline-workspace');

    expect(loadedWorkspace).toEqual(offlineWorkspace);
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

    localStorage.setItem('local_saved_workspaces', JSON.stringify([localWorkspace]));
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => cloudWorkspace,
    });

    const loadedWorkspace = await WorkspaceService.getWorkspace('versioned-workspace');

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

    localStorage.setItem('local_saved_workspaces', JSON.stringify([newerLocalWorkspace]));

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

    const loadedWorkspace = await WorkspaceService.getWorkspace('roster-persistence-workspace');
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
});
