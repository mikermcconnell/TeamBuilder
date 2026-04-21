import React, { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

import { useTeamBuilderActions } from '@/hooks/useTeamBuilderActions';
import type { AppState, LeagueConfig, Player, Team } from '@/types';
import type { StructuredWarning } from '@/types/StructuredWarning';

const baseConfig: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
  targetTeams: 2,
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

function createTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    name: 'Team 1',
    players: [],
    averageSkill: 0,
    genderBreakdown: { M: 0, F: 0, Other: 0 },
    ...overrides,
  };
}

function createAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    players: [],
    teams: [],
    unassignedPlayers: [],
    playerGroups: [],
    config: baseConfig,
    execRatingHistory: {},
    savedConfigs: [],
    teamIterations: [],
    activeTeamIterationId: null,
    ...overrides,
  };
}

function renderActions(initialState: AppState) {
  const snapshotCurrentState = vi.fn();
  const persistAppStateImmediately = vi.fn();
  const setActiveTab = vi.fn();
  const setIsManualMode = vi.fn();
  const setIsFullScreenMode = vi.fn();
  const setCurrentWorkspaceInfo = vi.fn();

  const hook = renderHook(({ initial }: { initial: AppState }) => {
    const [appState, setAppState] = useState(initial);
    const actions = useTeamBuilderActions({
      appState,
      setAppState,
      snapshotCurrentState,
      persistAppStateImmediately,
      setActiveTab,
      setIsManualMode,
      setIsFullScreenMode,
      setCurrentWorkspaceInfo,
    });

    return { appState, ...actions };
  }, {
    initialProps: { initial: initialState },
  });

  return {
    ...hook,
    snapshotCurrentState,
    persistAppStateImmediately,
    setActiveTab,
    setIsManualMode,
    setIsFullScreenMode,
    setCurrentWorkspaceInfo,
  };
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useTeamBuilderActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a fresh project when a new roster file is loaded', () => {
    const existingPlayer = createPlayer({
      id: 'existing-player',
      name: 'Existing Player',
      execSkillRating: 8,
    });
    const loadedPlayer = createPlayer({
      id: 'loaded-player',
      name: 'Loaded Player',
    });

    const { result, setCurrentWorkspaceInfo } = renderActions(createAppState({
      players: [existingPlayer],
      teams: [createTeam({ players: [existingPlayer], averageSkill: 8, genderBreakdown: { M: 1, F: 0, Other: 0 } })],
      unassignedPlayers: [existingPlayer],
      teamIterations: [
        {
          id: 'iteration-1',
          name: 'Tab 1',
          type: 'manual',
          status: 'ready',
          teams: [createTeam()],
          unassignedPlayers: [],
          createdAt: '2026-03-24T10:00:00.000Z',
        },
      ],
      activeTeamIterationId: 'iteration-1',
      leagueMemory: [
        {
          id: 'memory-1',
          title: 'Last season',
          createdAt: '2026-04-01T10:00:00.000Z',
          teams: [],
        },
      ],
    }));

    act(() => {
      result.current.handlePlayersLoaded([loadedPlayer], [], undefined, {
        sourceFileName: 'Spring Outdoor 2026.csv',
      });
    });

    expect(result.current.appState.players).toEqual([
      expect.objectContaining({ id: 'loaded-player', name: 'Loaded Player' }),
    ]);
    expect(result.current.appState.teams).toEqual([]);
    expect(result.current.appState.unassignedPlayers).toEqual([]);
    expect(result.current.appState.teamIterations).toEqual([]);
    expect(result.current.appState.activeTeamIterationId).toBeNull();
    expect(result.current.appState.leagueMemory).toEqual([]);
    expect(setCurrentWorkspaceInfo).toHaveBeenLastCalledWith(null, 'Spring Outdoor 2026', '');
  });

  it('refreshes current exec rankings without deleting stored history', () => {
    const ratedPlayer = createPlayer({
      id: 'rated-player',
      name: 'Rated Player',
      execSkillRating: 8.5,
    });

    const { result, snapshotCurrentState } = renderActions(createAppState({
      players: [ratedPlayer],
      teams: [createTeam({
        players: [ratedPlayer],
        averageSkill: 8.5,
        genderBreakdown: { M: 1, F: 0, Other: 0 },
      })],
      unassignedPlayers: [ratedPlayer],
      playerGroups: [
        {
          id: 'group-1',
          label: 'A',
          color: '#000',
          playerIds: [ratedPlayer.id],
          players: [ratedPlayer],
        },
      ],
      execRatingHistory: {
        'rated player': { rating: 8.5, updatedAt: 123 },
      },
    }));

    act(() => {
      result.current.handleClearExecRankings();
    });

    expect(snapshotCurrentState).toHaveBeenCalledTimes(1);
    expect(result.current.appState.players[0]?.execSkillRating).toBeNull();
    expect(result.current.appState.teams[0]?.players[0]?.execSkillRating).toBeNull();
    expect(result.current.appState.unassignedPlayers[0]?.execSkillRating).toBeNull();
    expect(result.current.appState.playerGroups[0]?.players[0]?.execSkillRating).toBeNull();
    expect(result.current.appState.execRatingHistory).toEqual({
      'rated player': { rating: 8.5, updatedAt: 123 },
    });
  });

  it('fully resets exec history when requested', () => {
    const ratedPlayer = createPlayer({
      id: 'rated-player',
      name: 'Rated Player',
      execSkillRating: 8.5,
    });

    const { result } = renderActions(createAppState({
      players: [ratedPlayer],
      execRatingHistory: {
        'rated player': { rating: 8.5, updatedAt: 123 },
      },
    }));

    act(() => {
      result.current.handleResetExecHistory();
    });

    expect(result.current.appState.players[0]?.execSkillRating).toBeNull();
    expect(result.current.appState.execRatingHistory).toEqual({});
  });

  it('keeps the configured team count in sync when teams are added or removed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const playerOnTeam = createPlayer({
      id: 'player-on-team',
      name: 'Player On Team',
      teamId: 'team-1',
    });
    const secondTeam = createTeam({
      id: 'team-2',
      name: 'Team 2',
    });

    const { result } = renderActions(createAppState({
      players: [playerOnTeam],
      teams: [
        createTeam({
          id: 'team-1',
          name: 'Team 1',
          players: [playerOnTeam],
          averageSkill: 7,
          genderBreakdown: { M: 1, F: 0, Other: 0 },
        }),
        secondTeam,
      ],
      config: {
        ...baseConfig,
        targetTeams: 2,
      },
    }));

    act(() => {
      result.current.handleAddTeam();
    });

    expect(result.current.appState.teams).toHaveLength(3);
    expect(result.current.appState.config.targetTeams).toBe(3);
    expect(result.current.appState.config.restrictToEvenTeams).toBe(false);

    act(() => {
      result.current.handleRemoveTeam('team-1');
    });

    expect(result.current.appState.teams).toHaveLength(2);
    expect(result.current.appState.config.targetTeams).toBe(2);
    expect(result.current.appState.config.restrictToEvenTeams).toBe(false);
    expect(result.current.appState.unassignedPlayers).toEqual([
      expect.objectContaining({ id: 'player-on-team', teamId: undefined }),
    ]);
    expect(result.current.appState.players[0]?.teamId).toBeUndefined();
  });

  it('keeps group player snapshots in sync when a grouped player is edited', () => {
    const groupedPlayer = createPlayer({
      id: 'grouped-player',
      name: 'Grouped Player',
      skillRating: 6,
    });

    const { result } = renderActions(createAppState({
      players: [groupedPlayer],
      playerGroups: [
        {
          id: 'group-1',
          label: 'A',
          color: '#000',
          playerIds: [groupedPlayer.id],
          players: [groupedPlayer],
        },
      ],
    }));

    act(() => {
      result.current.handlePlayerUpdate({
        ...groupedPlayer,
        skillRating: 9,
      });
    });

    expect(result.current.appState.playerGroups[0]?.players[0]?.skillRating).toBe(9);
    expect(result.current.appState.playerGroups[0]?.playerIds).toEqual(['grouped-player']);
  });

  it('adds a new player to the pool without resetting existing teams', () => {
    const assignedPlayer = createPlayer({
      id: 'assigned-player',
      name: 'Assigned Player',
      teamId: 'team-1',
    });
    const newPlayer = createPlayer({
      id: 'new-player',
      name: 'New Player',
      gender: 'F',
      skillRating: 5,
      teamId: undefined,
    });
    const existingTeam = createTeam({
      id: 'team-1',
      name: 'Team 1',
      players: [assignedPlayer],
      averageSkill: 7,
      genderBreakdown: { M: 1, F: 0, Other: 0 },
    });

    const { result, snapshotCurrentState } = renderActions(createAppState({
      players: [assignedPlayer],
      teams: [existingTeam],
      unassignedPlayers: [],
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          teams: [existingTeam],
          unassignedPlayers: [],
          createdAt: '2026-04-21T10:00:00.000Z',
        },
      ],
      activeTeamIterationId: 'manual-1',
    }));

    act(() => {
      result.current.handlePlayerAdd(newPlayer);
    });

    expect(snapshotCurrentState).toHaveBeenCalledTimes(1);
    expect(result.current.appState.players.map(player => player.id).sort()).toEqual(['assigned-player', 'new-player']);
    expect(result.current.appState.teams).toHaveLength(1);
    expect(result.current.appState.teams[0]?.players.map(player => player.id)).toEqual(['assigned-player']);
    expect(result.current.appState.unassignedPlayers.map(player => player.id)).toEqual(['new-player']);
    expect(result.current.appState.activeTeamIterationId).toBe('manual-1');
    expect(result.current.appState.teamIterations).toHaveLength(1);
    expect(result.current.appState.teamIterations[0]?.teams[0]?.players.map(player => player.id)).toEqual(['assigned-player']);
    expect(result.current.appState.teamIterations[0]?.unassignedPlayers.map(player => player.id)).toEqual(['new-player']);
  });

  it('updates ready team tabs even when a generating tab is active', () => {
    const assignedPlayer = createPlayer({
      id: 'assigned-player',
      name: 'Assigned Player',
      teamId: 'team-1',
    });
    const newPlayer = createPlayer({
      id: 'new-player',
      name: 'New Player',
      gender: 'F',
      skillRating: 5,
    });
    const manualTeam = createTeam({
      id: 'team-1',
      name: 'Team 1',
      players: [assignedPlayer],
      averageSkill: 7,
      genderBreakdown: { M: 1, F: 0, Other: 0 },
    });

    const { result } = renderActions(createAppState({
      players: [assignedPlayer],
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          teams: [manualTeam],
          unassignedPlayers: [],
          createdAt: '2026-04-21T10:00:00.000Z',
        },
        {
          id: 'ai-1',
          name: 'AI 1',
          type: 'ai',
          status: 'generating',
          teams: [],
          unassignedPlayers: [],
          createdAt: '2026-04-21T10:01:00.000Z',
        },
      ],
      activeTeamIterationId: 'ai-1',
    }));

    act(() => {
      result.current.handlePlayerAdd(newPlayer);
    });

    const manualIteration = result.current.appState.teamIterations.find(iteration => iteration.id === 'manual-1');
    const generatingIteration = result.current.appState.teamIterations.find(iteration => iteration.id === 'ai-1');

    expect(manualIteration?.teams[0]?.players.map(player => player.id)).toEqual(['assigned-player']);
    expect(manualIteration?.unassignedPlayers.map(player => player.id)).toEqual(['new-player']);
    expect(generatingIteration?.teams).toEqual([]);
    expect(generatingIteration?.unassignedPlayers).toEqual([]);
    expect(result.current.appState.activeTeamIterationId).toBe('ai-1');
  });

  it('persists immediately when requested for a player review toggle', async () => {
    const reviewedPlayer = createPlayer({
      id: 'review-player',
      name: 'Review Player',
      isNewPlayer: true,
    });

    const { result, persistAppStateImmediately } = renderActions(createAppState({
      players: [reviewedPlayer],
      unassignedPlayers: [reviewedPlayer],
    }));

    act(() => {
      result.current.handlePlayerUpdate({
        ...reviewedPlayer,
        isNewPlayer: false,
      }, { persistImmediately: true });
    });

    await flushMicrotasks();

    expect(result.current.appState.players[0]?.isNewPlayer).toBe(false);
    expect(persistAppStateImmediately).toHaveBeenCalledWith(expect.objectContaining({
      players: [
        expect.objectContaining({
          id: 'review-player',
          isNewPlayer: false,
        }),
      ],
    }));
  });

  it('flushes a moved player state immediately for persistence', async () => {
    const movedPlayer = createPlayer({
      id: 'move-player',
      name: 'Move Player',
      teamId: 'team-1',
    });

    const { result, persistAppStateImmediately } = renderActions(createAppState({
      players: [movedPlayer],
      teams: [
        createTeam({
          id: 'team-1',
          players: [movedPlayer],
          averageSkill: 7,
          genderBreakdown: { M: 1, F: 0, Other: 0 },
        }),
      ],
      unassignedPlayers: [],
    }));

    act(() => {
      result.current.handlePlayerMove('move-player', null);
    });

    await flushMicrotasks();

    expect(persistAppStateImmediately).toHaveBeenCalledWith(expect.objectContaining({
      players: [
        expect.objectContaining({
          id: 'move-player',
          teamId: undefined,
        }),
      ],
      unassignedPlayers: [
        expect.objectContaining({
          id: 'move-player',
        }),
      ],
    }));
  });

  it('creates a mutual-request group when a warning resolution fixes a missing teammate match', () => {
    const alex = createPlayer({
      id: 'alex',
      name: 'Alex Example',
      gender: 'M',
      teammateRequests: [],
    });
    const bob = createPlayer({
      id: 'bob',
      name: 'Bob Example',
      gender: 'M',
      teammateRequests: ['Alex Example'],
    });
    const warning: StructuredWarning = {
      id: 'warning-1',
      category: 'not-found',
      message: 'Player "Alex Example": Teammate request "Bobb Example" not found. Did you mean "Bob Example"?',
      playerName: 'Alex Example',
      requestedName: 'Bobb Example',
      matchedName: 'Bob Example',
      confidence: 'low',
      status: 'pending',
    };

    const { result } = renderActions(createAppState({
      players: [alex, bob],
      pendingWarnings: [warning],
    }));

    act(() => {
      result.current.handleResolveWarning({
        ...warning,
        status: 'accepted',
      });
    });

    expect(result.current.appState.players.find(player => player.id === 'alex')?.teammateRequests).toEqual(['Bob Example']);
    expect(result.current.appState.playerGroups).toHaveLength(1);
    expect(result.current.appState.playerGroups[0]?.playerIds.sort()).toEqual(['alex', 'bob']);
    expect(result.current.appState.pendingWarnings?.[0]?.status).toBe('accepted');
  });

  it('removes stale player ids from groups when a player is deleted', () => {
    const firstPlayer = createPlayer({
      id: 'player-1',
      name: 'Player One',
      gender: 'M',
      groupId: 'group-1',
    });
    const secondPlayer = createPlayer({
      id: 'player-2',
      name: 'Player Two',
      gender: 'F',
      groupId: 'group-1',
    });

    const { result } = renderActions(createAppState({
      players: [firstPlayer, secondPlayer],
      playerGroups: [
        {
          id: 'group-1',
          label: 'A',
          color: '#000',
          playerIds: [firstPlayer.id, secondPlayer.id],
          players: [firstPlayer, secondPlayer],
        },
      ],
    }));

    act(() => {
      result.current.handlePlayerRemove('player-1');
    });

    expect(result.current.appState.playerGroups[0]?.playerIds).toEqual(['player-2']);
    expect(result.current.appState.playerGroups[0]?.players.map(player => player.id)).toEqual(['player-2']);
  });
});
