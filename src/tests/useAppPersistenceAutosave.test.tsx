import React, { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppState, LeagueConfig, Player } from '@/types';

const toastMocks = vi.hoisted(() => ({
  warning: vi.fn(),
  error: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  setUser: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

vi.mock('@/services/dataStorageService', () => ({
  dataStorageService: storageMocks,
}));

import { useAppPersistence } from '@/hooks/useAppPersistence';

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
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

function createAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    players: [],
    teams: [],
    unassignedPlayers: [],
    playerGroups: [],
    config,
    execRatingHistory: {},
    savedConfigs: [],
    teamIterations: [],
    activeTeamIterationId: null,
    leagueMemory: [],
    pendingWarnings: [],
    ...overrides,
  };
}

function renderPersistence(options?: {
  initialState?: AppState;
  user?: { uid: string } | null;
  currentWorkspaceId?: string | null;
  workspaceName?: string;
  workspaceDescription?: string;
  saveWorkspace?: ReturnType<typeof vi.fn>;
}) {
  const saveWorkspace = options?.saveWorkspace ?? vi.fn().mockResolvedValue(undefined);

  const hook = renderHook(({ initialState }: { initialState: AppState }) => {
    const [appState, setAppState] = useState(initialState);

    const persistence = useAppPersistence({
      user: (options?.user ?? null) as never,
      appState,
      setAppState,
      currentWorkspaceId: options?.currentWorkspaceId ?? null,
      workspaceName: options?.workspaceName ?? '',
      workspaceDescription: options?.workspaceDescription ?? '',
      saveWorkspace,
    });

    return {
      appState,
      setAppState,
      ...persistence,
    };
  }, {
    initialProps: {
      initialState: options?.initialState ?? createAppState(),
    },
  });

  return { ...hook, saveWorkspace };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAppPersistence autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    storageMocks.load.mockResolvedValue(null);
    storageMocks.save.mockResolvedValue({ type: 'local' });
  });

  it('autosaves device state after app state changes', async () => {
    const { result } = renderPersistence({
      initialState: createAppState(),
      user: { uid: 'user-1' },
    });

    await flushEffects();
    expect(result.current.dataLoaded).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    storageMocks.save.mockClear();

    act(() => {
      result.current.setAppState(prev => ({
        ...prev,
        players: [createPlayer({ id: 'player-2', name: 'Saved Player' })],
      }));
    });

    expect(storageMocks.save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(storageMocks.save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushEffects();

    expect(storageMocks.save).toHaveBeenCalledWith(expect.objectContaining({
      players: [expect.objectContaining({ id: 'player-2', name: 'Saved Player' })],
    }));
  });

  it('autosaves the current project after the longer workspace debounce', async () => {
    storageMocks.save.mockResolvedValue({ type: 'cloud' });

    const saveWorkspace = vi.fn().mockResolvedValue({ id: 'workspace-1', type: 'cloud' });

    const { result } = renderPersistence({
      initialState: createAppState(),
      user: { uid: 'user-1' },
      currentWorkspaceId: 'workspace-1',
      workspaceName: 'Spring Outdoor 2026',
      workspaceDescription: 'League draft',
      saveWorkspace,
    });

    await flushEffects();
    expect(result.current.dataLoaded).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    saveWorkspace.mockClear();

    act(() => {
      result.current.setAppState(prev => ({
        ...prev,
        teams: [
          {
            id: 'team-1',
            name: 'Blue Jays',
            players: [],
            averageSkill: 0,
            genderBreakdown: { M: 0, F: 0, Other: 0 },
          },
        ],
      }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(saveWorkspace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushEffects();

    expect(saveWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      teams: [expect.objectContaining({ id: 'team-1', name: 'Blue Jays' })],
    }), expect.objectContaining({
      id: 'workspace-1',
      name: 'Spring Outdoor 2026',
      description: 'League draft',
      silent: true,
      refreshList: false,
    }));
  });
});
