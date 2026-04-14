import { Dispatch, SetStateAction, useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { AppState, LeagueConfig, Player, PlayerGroup, Team, getEffectiveSkillRating } from '@/types';
import { StructuredWarning } from '@/types/StructuredWarning';
import { saveDefaultConfig } from '@/utils/configManager';
import { normalizeLeagueConfig } from '@/utils/teamCount';
import { generateBalancedTeams } from '@/utils/teamGenerator';
import { applyTeamBranding, ensureUniqueTeamNames, getColorName, getTeamBrandPalette } from '@/utils/teamBranding';
import { processMutualRequests, validateGroupsForGeneration } from '@/utils/playerGrouping';
import { syncActiveTeamIterationToState } from '@/utils/teamIterations';
import { debounce } from '@/utils/performance';
import { validateTeamName } from '@/utils/validation';
import { applyWarningResolutionToRequests, isAvoidWarning } from '@/utils/warningResolution';

const normalizeName = (name: string): string => name.trim().toLowerCase();
const GROUP_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316',
  '#06B6D4', '#84CC16', '#EC4899', '#6B7280', '#14B8A6', '#F43F5E'
];

function syncPlayersAndGroups(players: Player[], playerGroups: PlayerGroup[]) {
  const playersById = new Map(players.map(player => [player.id, player]));

  const syncedPlayerGroups = playerGroups
    .map(group => {
      const playerIds = Array.from(new Set([
        ...group.playerIds,
        ...group.players.map(player => player.id),
      ])).filter(playerId => playersById.has(playerId));

      const syncedPlayers = playerIds
        .map(playerId => playersById.get(playerId))
        .filter((player): player is Player => Boolean(player));

      if (syncedPlayers.length === 0) {
        return null;
      }

      return {
        ...group,
        playerIds,
        players: syncedPlayers,
      };
    })
    .filter((group): group is PlayerGroup => Boolean(group));

  const playerGroupMap = new Map<string, string>();
  syncedPlayerGroups.forEach(group => {
    group.playerIds.forEach(playerId => {
      playerGroupMap.set(playerId, group.id);
    });
  });

  const syncedPlayers = players.map(player => {
    const groupId = playerGroupMap.get(player.id);

    if (groupId) {
      return player.groupId === groupId ? player : { ...player, groupId };
    }

    return player.groupId === undefined ? player : { ...player, groupId: undefined };
  });

  return {
    players: syncedPlayers,
    playerGroups: syncedPlayerGroups,
  };
}

function getNextGroupLabel(usedLabels: Set<string>): string {
  for (let i = 0; i < 26; i++) {
    const label = String.fromCharCode(65 + i);
    if (!usedLabels.has(label)) {
      usedLabels.add(label);
      return label;
    }
  }

  const fallbackLabel = `G${usedLabels.size + 1}`;
  usedLabels.add(fallbackLabel);
  return fallbackLabel;
}

function appendDerivedGroups(players: Player[], existingGroups: PlayerGroup[]) {
  const syncedState = syncPlayersAndGroups(players, existingGroups);
  const ungroupedPlayers = syncedState.players.filter(player => !player.groupId);

  if (ungroupedPlayers.length < 2) {
    return syncedState;
  }

  const { playerGroups: derivedGroups } = processMutualRequests(ungroupedPlayers);
  if (derivedGroups.length === 0) {
    return syncedState;
  }

  const usedLabels = new Set(syncedState.playerGroups.map(group => group.label));
  const remappedGroups = derivedGroups.map((group, index) => ({
    ...group,
    id: `group-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    label: getNextGroupLabel(usedLabels),
    color: GROUP_COLORS[(syncedState.playerGroups.length + index) % GROUP_COLORS.length] || GROUP_COLORS[0] || '#3B82F6',
  }));

  const derivedGroupByPlayerId = new Map<string, string>();
  remappedGroups.forEach(group => {
    group.playerIds.forEach(playerId => {
      derivedGroupByPlayerId.set(playerId, group.id);
    });
  });

  const updatedPlayers = syncedState.players.map(player => {
    const derivedGroupId = derivedGroupByPlayerId.get(player.id);
    return derivedGroupId ? { ...player, groupId: derivedGroupId } : player;
  });

  return syncPlayersAndGroups(updatedPlayers, [...syncedState.playerGroups, ...remappedGroups]);
}

interface TeamBrandingChange {
  name?: string;
  color?: string;
  colorName?: string;
  resetName?: boolean;
  resetColor?: boolean;
}

interface UseTeamBuilderActionsOptions {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  snapshotCurrentState: () => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  setIsManualMode: Dispatch<SetStateAction<boolean>>;
  setIsFullScreenMode: Dispatch<SetStateAction<boolean>>;
  setCurrentWorkspaceInfo: (id: string | null, name: string, description: string) => void;
}

export function useTeamBuilderActions({
  appState,
  setAppState,
  snapshotCurrentState,
  setActiveTab,
  setIsManualMode,
  setIsFullScreenMode,
  setCurrentWorkspaceInfo,
}: UseTeamBuilderActionsOptions) {
  const syncActiveIteration = useCallback((state: AppState) => syncActiveTeamIterationToState(state), []);

  const syncTargetTeamCount = (config: LeagueConfig, teamCount: number): LeagueConfig => ({
    ...config,
    targetTeams: teamCount > 0 ? teamCount : undefined,
  });

  const clearExecRankingsFromState = useCallback((state: AppState, resetHistory: boolean): AppState => {
    const clearExecRanking = (player: Player): Player => ({
      ...player,
      execSkillRating: null
    });

    const updatedPlayers = state.players.map(clearExecRanking);
    const updatedTeams = state.teams.map(team => {
      const updatedTeamPlayers = team.players.map(clearExecRanking);
      const totalSkill = updatedTeamPlayers.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0);

      return {
        ...team,
        players: updatedTeamPlayers,
        averageSkill: updatedTeamPlayers.length > 0 ? totalSkill / updatedTeamPlayers.length : 0,
      };
    });

    const updatedUnassignedPlayers = state.unassignedPlayers.map(clearExecRanking);
    const updatedPlayerGroups = state.playerGroups.map(group => ({
      ...group,
      players: group.players.map(clearExecRanking)
    }));

    return syncActiveIteration({
      ...state,
      players: updatedPlayers,
      teams: updatedTeams,
      unassignedPlayers: updatedUnassignedPlayers,
      playerGroups: updatedPlayerGroups,
      execRatingHistory: resetHistory ? {} : state.execRatingHistory,
    });
  }, [syncActiveIteration]);

  const deriveWorkspaceNameFromFile = (sourceFileName?: string) => {
    const trimmedName = sourceFileName?.trim();
    if (!trimmedName) {
      return `Project ${new Date().toLocaleDateString()}`;
    }

    return trimmedName.replace(/\.[^/.]+$/, '').trim() || `Project ${new Date().toLocaleDateString()}`;
  };

  const handlePlayersLoaded = useCallback((
    players: Player[],
    playerGroups: PlayerGroup[] = [],
    warnings?: StructuredWarning[],
    metadata?: { sourceFileName?: string }
  ) => {
    setAppState(prev => {
      const execRatingHistory = { ...prev.execRatingHistory };

      prev.players.forEach(existingPlayer => {
        if (existingPlayer.execSkillRating !== null) {
          const key = normalizeName(existingPlayer.name);
          if (!execRatingHistory[key]) {
            execRatingHistory[key] = { rating: existingPlayer.execSkillRating, updatedAt: 0 };
          }
        }
      });

      const now = Date.now();
      const updatedPlayers = players.map(player => {
        const nameKey = normalizeName(player.name);
        const csvExec = player.execSkillRating !== null && player.execSkillRating !== undefined
          ? player.execSkillRating
          : null;

        const historyEntry = execRatingHistory[nameKey];

        let finalExec: number | null = null;
        let isNewFromCSV = false;

        if (csvExec !== null) {
          finalExec = csvExec;
          isNewFromCSV = true;
        } else if (historyEntry) {
          finalExec = historyEntry.rating;
        }

        if (finalExec !== null && isNewFromCSV) {
          execRatingHistory[nameKey] = { rating: finalExec, updatedAt: now };
        }

        return {
          ...player,
          execSkillRating: finalExec
        };
      });

      const playersById = new Map(updatedPlayers.map(player => [player.id, player]));
      const updatedPlayerGroups = playerGroups.map(group => ({
        ...group,
        players: group.players.map(groupPlayer => playersById.get(groupPlayer.id) ?? groupPlayer)
      }));

      return {
        ...prev,
        players: updatedPlayers,
        playerGroups: updatedPlayerGroups,
        teams: [],
        unassignedPlayers: [],
        stats: undefined,
        teamIterations: [],
        activeTeamIterationId: null,
        leagueMemory: [],
        execRatingHistory,
        pendingWarnings: warnings
      };
    });

    setIsManualMode(false);
    setIsFullScreenMode(false);

    if (players.length > 0) {
      setActiveTab('roster');
      const groupedPlayerCount = playerGroups.reduce((sum, group) => sum + group.players.length, 0);
      if (groupedPlayerCount > 0) {
        toast.success('Loaded ' + players.length + ' players with ' + playerGroups.length + ' groups');
      } else {
        toast.success('Loaded ' + players.length + ' players successfully');
      }
    }

    setCurrentWorkspaceInfo(null, deriveWorkspaceNameFromFile(metadata?.sourceFileName), '');
  }, [setActiveTab, setAppState, setCurrentWorkspaceInfo, setIsFullScreenMode, setIsManualMode]);

  const handleConfigChange = useCallback((config: LeagueConfig) => {
    const normalizedConfig = normalizeLeagueConfig(config);
    setAppState(prev => ({ ...prev, config: normalizedConfig }));
    saveDefaultConfig(normalizedConfig);
  }, [setAppState]);

  const handleGenerateTeams = useCallback(async (randomize: boolean = false, manualMode: boolean = false) => {
    if (appState.players.length === 0) {
      toast.error('Please upload players first');
      return;
    }

    snapshotCurrentState();

    const validation = validateGroupsForGeneration(appState.playerGroups, appState.config.maxTeamSize);

    if (!validation.valid) {
      validation.errors.forEach(error => {
        toast.error(error, { duration: 5000 });
      });
      return;
    }

    validation.warnings.forEach(warning => {
      toast.warning(warning, { duration: 4000 });
    });

    setIsManualMode(manualMode);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = generateBalancedTeams(appState.players, appState.config, appState.playerGroups, randomize, manualMode);

      setAppState(prev => syncActiveIteration({
        ...prev,
        teams: applyTeamBranding(result.teams, appState.playerGroups, appState.config, { forceRename: true }),
        unassignedPlayers: result.unassignedPlayers,
        stats: result.stats
      }));

      setActiveTab('teams');

      const message = manualMode
        ? `Created ${result.teams.length} manual teams - drag players to complete setup`
        : randomize
          ? `Generated ${result.teams.length} random teams`
          : `Generated ${result.teams.length} balanced teams`;

      toast.success(message);

      if (result.stats.mustHaveRequestsBroken > 0) {
        toast.warning(`${result.stats.mustHaveRequestsBroken} must-have requests could not be honored`, { duration: 4000 });
      }

      if (result.unassignedPlayers.length > 0) {
        toast.warning(`${result.unassignedPlayers.length} players could not be assigned due to constraints`);
      }
    } catch (error) {
      console.error('Team generation failed:', error);
      toast.error('Failed to generate teams. Please check your configuration.');
    }
  }, [appState.config, appState.playerGroups, appState.players, setActiveTab, setAppState, setIsManualMode, snapshotCurrentState, syncActiveIteration]);

  const handlePlayerUpdate = useCallback((updatedPlayer: Player) => {
    snapshotCurrentState();
    setAppState(prev => {
      const existingPlayer = prev.players.find(p => p.id === updatedPlayer.id);
      const updatedHistory = { ...prev.execRatingHistory };

      if (existingPlayer) {
        const newKey = normalizeName(updatedPlayer.name);

        if (updatedPlayer.execSkillRating !== null && updatedPlayer.execSkillRating !== undefined) {
          updatedHistory[newKey] = { rating: updatedPlayer.execSkillRating, updatedAt: Date.now() };
        }
      } else if (updatedPlayer.execSkillRating !== null && updatedPlayer.execSkillRating !== undefined) {
        updatedHistory[normalizeName(updatedPlayer.name)] = { rating: updatedPlayer.execSkillRating, updatedAt: Date.now() };
      }

      const updatedPlayers = prev.players.map(p =>
        p.id === updatedPlayer.id ? updatedPlayer : p
      );

      const updatedTeams = prev.teams.map(team => {
        const playerInTeam = team.players.find(p => p.id === updatedPlayer.id);
        if (playerInTeam) {
          const updatedTeamPlayers = team.players.map(p =>
            p.id === updatedPlayer.id ? updatedPlayer : p
          );

          const totalSkill = updatedTeamPlayers.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0);
          const averageSkill = updatedTeamPlayers.length > 0 ? totalSkill / updatedTeamPlayers.length : 0;

          const genderBreakdown = { M: 0, F: 0, Other: 0 };
          updatedTeamPlayers.forEach(p => {
            genderBreakdown[p.gender]++;
          });

          return {
            ...team,
            players: updatedTeamPlayers,
            averageSkill,
            genderBreakdown
          };
        }
        return team;
      });

      const updatedUnassigned = prev.unassignedPlayers.map(p =>
        p.id === updatedPlayer.id ? updatedPlayer : p
      );

      const syncedGroupState = syncPlayersAndGroups(updatedPlayers, prev.playerGroups);

      return syncActiveIteration({
        ...prev,
        players: syncedGroupState.players,
        teams: updatedTeams,
        unassignedPlayers: updatedUnassigned,
        playerGroups: syncedGroupState.playerGroups,
        execRatingHistory: updatedHistory
      });
    });
  }, [setAppState, snapshotCurrentState, syncActiveIteration]);

  const handlePlayerAdd = useCallback((newPlayer: Player) => {
    snapshotCurrentState();
    setAppState(prev => {
      const updatedHistory = { ...prev.execRatingHistory };
      if (newPlayer.execSkillRating !== null && newPlayer.execSkillRating !== undefined) {
        updatedHistory[normalizeName(newPlayer.name)] = { rating: newPlayer.execSkillRating, updatedAt: Date.now() };
      }

      return {
        ...prev,
        players: [...prev.players, newPlayer],
        teams: [],
        unassignedPlayers: [],
        stats: undefined,
        teamIterations: [],
        activeTeamIterationId: null,
        execRatingHistory: updatedHistory
      };
    });
  }, [setAppState, snapshotCurrentState]);

  const handleResolveWarning = useCallback((warning: StructuredWarning) => {
    setAppState(prev => {
      if (!prev.pendingWarnings) return prev;

      const player = prev.players.find(p => p.name === warning.playerName);
      if (!player || !warning.matchedName) return prev;

      const updatedPlayer = {
        ...player,
        teammateRequests: applyWarningResolutionToRequests(
          player.teammateRequests,
          warning,
          !isAvoidWarning(warning)
        ),
        avoidRequests: applyWarningResolutionToRequests(
          player.avoidRequests,
          warning,
          isAvoidWarning(warning)
        )
      };

      const updatedWarnings = prev.pendingWarnings.map(w =>
        w.id === warning.id ? { ...w, status: 'accepted' as const, matchedName: warning.matchedName } : w
      );

      const updatedPlayers = prev.players.map(p => p.id === player.id ? updatedPlayer : p);
      const syncedGroupState = appendDerivedGroups(updatedPlayers, prev.playerGroups);

      return {
        ...prev,
        players: syncedGroupState.players,
        playerGroups: syncedGroupState.playerGroups,
        pendingWarnings: updatedWarnings
      };
    });
  }, [setAppState]);

  const handleDismissWarning = useCallback((warningId: string) => {
    setAppState(prev => {
      if (!prev.pendingWarnings) return prev;

      const updatedWarnings = prev.pendingWarnings.map(w =>
        w.id === warningId ? { ...w, status: 'rejected' as const } : w
      );

      return {
        ...prev,
        pendingWarnings: updatedWarnings
      };
    });
  }, [setAppState]);

  const handleDismissAllWarnings = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      pendingWarnings: []
    }));
  }, [setAppState]);

  const handlePlayerRemove = useCallback((playerId: string) => {
    snapshotCurrentState();
    setAppState(prev => {
      const removedPlayer = prev.players.find(p => p.id === playerId);
      if (!removedPlayer) return prev;

      const updatedPlayers = prev.players.filter(p => p.id !== playerId);

      const updatedTeams = prev.teams.map(team => {
        const playerInTeam = team.players.find(p => p.id === playerId);
        if (playerInTeam) {
          const updatedTeamPlayers = team.players.filter(p => p.id !== playerId);

          const totalSkill = updatedTeamPlayers.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0);
          const averageSkill = updatedTeamPlayers.length > 0 ? totalSkill / updatedTeamPlayers.length : 0;

          const genderBreakdown = { M: 0, F: 0, Other: 0 };
          updatedTeamPlayers.forEach(p => {
            genderBreakdown[p.gender]++;
          });

          return {
            ...team,
            players: updatedTeamPlayers,
            averageSkill,
            genderBreakdown
          };
        }
        return team;
      });

      const updatedUnassigned = prev.unassignedPlayers.filter(p => p.id !== playerId);

      const updatedPlayerGroups = prev.playerGroups.map(group => ({
        ...group,
        playerIds: group.playerIds.filter(id => id !== playerId),
        players: group.players.filter(p => p.id !== playerId)
      })).filter(group => group.players.length > 0);

      const cleanedPlayers = updatedPlayers.map(player => ({
        ...player,
        teammateRequests: player.teammateRequests.filter(name =>
          name.toLowerCase() !== removedPlayer.name.toLowerCase()
        ),
        avoidRequests: player.avoidRequests.filter(name =>
          name.toLowerCase() !== removedPlayer.name.toLowerCase()
        )
      }));

      return syncActiveIteration({
        ...prev,
        players: cleanedPlayers,
        teams: updatedTeams,
        unassignedPlayers: updatedUnassigned,
        playerGroups: updatedPlayerGroups
      });
    });
  }, [setAppState, snapshotCurrentState, syncActiveIteration]);

  const handlePlayerMove = useCallback((playerId: string, targetTeamId: string | null) => {
    snapshotCurrentState();

    setAppState(prev => {
      const updatedTeams = prev.teams.map(team => ({
        ...team,
        players: team.players.filter(p => p.id !== playerId)
      }));

      let updatedUnassigned = [...prev.unassignedPlayers];
      const player = prev.players.find(p => p.id === playerId);

      if (!player) return prev;

      const updatedPlayer = { ...player, teamId: targetTeamId || undefined };

      if (targetTeamId) {
        const targetTeam = updatedTeams.find(t => t.id === targetTeamId);
        if (targetTeam) {
          targetTeam.players.push(updatedPlayer);
          updatedUnassigned = updatedUnassigned.filter(p => p.id !== playerId);
        }
      } else if (!updatedUnassigned.find(p => p.id === playerId)) {
        updatedUnassigned.push(updatedPlayer);
      }

      const updatedPlayers = prev.players.map(p =>
        p.id === playerId ? updatedPlayer : p
      );

      updatedTeams.forEach(team => {
        const totalSkill = team.players.reduce((sum, p) => {
          const skill = (p.execSkillRating !== null && p.execSkillRating !== undefined)
            ? p.execSkillRating
            : p.skillRating;
          return sum + skill;
        }, 0);
        team.averageSkill = team.players.length > 0 ? totalSkill / team.players.length : 0;
        team.genderBreakdown = { M: 0, F: 0, Other: 0 };
        team.players.forEach(p => {
          team.genderBreakdown[p.gender]++;
        });
      });

      return syncActiveIteration({
        ...prev,
        players: updatedPlayers,
        teams: updatedTeams,
        unassignedPlayers: updatedUnassigned
      });
    });
  }, [setAppState, snapshotCurrentState, syncActiveIteration]);

  const handleClearExecRankings = useCallback(() => {
    const execRankingsCount = appState.players.filter(player => player.execSkillRating !== null).length;

    if (execRankingsCount === 0) {
      toast.info('No current exec rankings to clear');
      return;
    }

    snapshotCurrentState();
    setAppState(prev => clearExecRankingsFromState(prev, false));

    toast.success(`Cleared current exec rankings for ${execRankingsCount} player${execRankingsCount === 1 ? '' : 's'} and kept stored history`);
  }, [appState.players, clearExecRankingsFromState, setAppState, snapshotCurrentState]);

  const handleResetExecHistory = useCallback(() => {
    const execRankingsCount = appState.players.filter(player => player.execSkillRating !== null).length;
    const execHistoryCount = Object.keys(appState.execRatingHistory || {}).length;

    if (execRankingsCount === 0 && execHistoryCount === 0) {
      toast.info('No exec rankings or stored history to reset');
      return;
    }

    snapshotCurrentState();
    setAppState(prev => clearExecRankingsFromState(prev, true));

    toast.success(`Reset exec history and cleared rankings for ${execRankingsCount} player${execRankingsCount === 1 ? '' : 's'}`);
  }, [appState.execRatingHistory, appState.players, clearExecRankingsFromState, setAppState, snapshotCurrentState]);

  const handleResetTeams = useCallback(() => {
    setAppState(prev => {
      const updatedPlayers = prev.players.map(p => ({
        ...p,
        teamId: undefined
      }));

      const updatedTeams = prev.teams.map(team => ({
        ...team,
        players: [],
        averageSkill: 0,
        genderBreakdown: { M: 0, F: 0, Other: 0 }
      }));

      return syncActiveIteration({
        ...prev,
        players: updatedPlayers,
        teams: updatedTeams,
        unassignedPlayers: updatedPlayers
      });
    });
  }, [setAppState, syncActiveIteration]);

  const debouncedTeamNameChangeRef = useRef(
    debounce((teamId: string, newName: string) => {
      setAppState(prev => syncActiveIteration({
        ...prev,
        teams: ensureUniqueTeamNames(prev.teams.map(team =>
          team.id === teamId
            ? {
              ...team,
              name: validateTeamName(newName),
              isNameManuallySet: true
            }
            : team
        ))
      }));
    }, 300)
  );

  const handleTeamNameChange = useCallback((teamId: string, newName: string) => {
    debouncedTeamNameChangeRef.current(teamId, newName);
  }, []);

  const handleTeamBrandingChange = useCallback((teamId: string, updates: TeamBrandingChange) => {
    setAppState(prev => {
      const teamIndex = prev.teams.findIndex(team => team.id === teamId);
      if (teamIndex < 0) {
        return prev;
      }

      const updatedTeams = prev.teams.map(team => {
        if (team.id !== teamId) {
          return team;
        }

        const nextTeam = { ...team };

        if (updates.name !== undefined) {
          nextTeam.name = validateTeamName(updates.name);
          nextTeam.isNameManuallySet = true;
        }

        if (updates.color !== undefined) {
          nextTeam.color = updates.color;
          nextTeam.colorName = updates.colorName || getColorName(updates.color);
          nextTeam.isColorManuallySet = true;
        }

        if (updates.resetName) {
          nextTeam.isNameManuallySet = false;
          nextTeam.name = `Team ${teamIndex + 1}`;
        }

        if (updates.resetColor) {
          nextTeam.isColorManuallySet = false;
          nextTeam.color = undefined;
          nextTeam.colorName = undefined;
        }

        return nextTeam;
      });

      return syncActiveIteration({
        ...prev,
        teams: ensureUniqueTeamNames(applyTeamBranding(updatedTeams, prev.playerGroups, prev.config, {
          forceRename: updates.resetName,
          forceColor: updates.resetColor,
        }))
      });
    });
  }, [setAppState, syncActiveIteration]);

  const handleRefreshTeamBranding = useCallback(() => {
    setAppState(prev => syncActiveIteration({
      ...prev,
      teams: applyTeamBranding(prev.teams, prev.playerGroups, prev.config, {
        forceRename: true,
        forceColor: true,
      })
    }));
    toast.success('Refreshed team names and colors');
  }, [setAppState, syncActiveIteration]);

  const handleAddTeam = useCallback(() => {
    snapshotCurrentState();

    setAppState(prev => {
      const palette = getTeamBrandPalette(prev.teams.length);
      const newTeam: Team = {
        id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${palette.colorName} ${palette.mascot}`,
        color: palette.color,
        colorName: palette.colorName,
        players: [],
        averageSkill: 0,
        genderBreakdown: { M: 0, F: 0, Other: 0 },
      };

      return syncActiveIteration({
        ...prev,
        teams: ensureUniqueTeamNames([...prev.teams, newTeam]),
        config: syncTargetTeamCount(prev.config, prev.teams.length + 1),
      });
    });

    toast.success('Added a new team');
  }, [setAppState, snapshotCurrentState, syncActiveIteration]);

  const handleRemoveTeam = useCallback((teamId: string) => {
    const teamToRemove = appState.teams.find(team => team.id === teamId);
    if (!teamToRemove) {
      return;
    }

    const confirmRemove = window.confirm(
      teamToRemove.players.length > 0
        ? `Remove "${teamToRemove.name}"? Its players will move back to the Player Pool.`
        : `Remove "${teamToRemove.name}"?`
    );

    if (!confirmRemove) {
      return;
    }

    snapshotCurrentState();

    setAppState(prev => {
      const team = prev.teams.find(existingTeam => existingTeam.id === teamId);
      if (!team) {
        return prev;
      }

      const releasedPlayers = team.players.map(player => ({
        ...player,
        teamId: undefined,
      }));
      const releasedPlayerIds = new Set(releasedPlayers.map(player => player.id));

      const updatedPlayers = prev.players.map(player => (
        releasedPlayerIds.has(player.id)
          ? { ...player, teamId: undefined }
          : player
      ));

      const updatedUnassignedPlayers = [
        ...prev.unassignedPlayers.filter(player => !releasedPlayerIds.has(player.id)),
        ...releasedPlayers,
      ];
      const updatedTeams = prev.teams.filter(existingTeam => existingTeam.id !== teamId);

      return syncActiveIteration({
        ...prev,
        players: updatedPlayers,
        teams: updatedTeams,
        unassignedPlayers: updatedUnassignedPlayers,
        config: syncTargetTeamCount(prev.config, updatedTeams.length),
      });
    });

    toast.success(`Removed ${teamToRemove.name}`);
  }, [appState.teams, setAppState, snapshotCurrentState, syncActiveIteration]);

  const handleAddPlayerToGroup = useCallback((playerId: string, groupId: string) => {
    setAppState(prev => {
      const targetGroup = prev.playerGroups.find(g => g.id === groupId);
      const player = prev.players.find(p => p.id === playerId);

      if (!targetGroup || !player || targetGroup.players.length >= 4) {
        return prev;
      }

      const updatedGroups = prev.playerGroups.map(group => {
        if (group.id === groupId) {
          return {
            ...group,
            playerIds: [...group.playerIds, playerId],
            players: [...group.players, player]
          };
        }
        return group;
      });

      const updatedPlayers = prev.players.map(p =>
        p.id === playerId ? { ...p, groupId } : p
      );

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, [setAppState]);

  const handleRemovePlayerFromGroup = useCallback((playerId: string) => {
    setAppState(prev => {
      const updatedGroups = prev.playerGroups.map(group => ({
        ...group,
        playerIds: group.playerIds.filter(id => id !== playerId),
        players: group.players.filter(p => p.id !== playerId)
      })).filter(group => group.players.length > 0);

      const updatedPlayers = prev.players.map(p =>
        p.id === playerId ? { ...p, groupId: undefined } : p
      );

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, [setAppState]);

  const handleCreateNewGroup = useCallback((playerIds: string[]) => {
    setAppState(prev => {
      const selectedPlayers = prev.players.filter(p => playerIds.includes(p.id));

      if (selectedPlayers.length === 0 || selectedPlayers.length > 4) {
        return prev;
      }

      const usedLabels = prev.playerGroups.map(g => g.label);
      let nextLabel = 'A';
      for (let i = 0; i < 26; i++) {
        const label = String.fromCharCode(65 + i);
        if (!usedLabels.includes(label)) {
          nextLabel = label;
          break;
        }
      }

      const colors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316',
        '#06B6D4', '#84CC16', '#EC4899', '#6B7280', '#14B8A6', '#F43F5E'
      ];
      const groupColor = colors[prev.playerGroups.length % colors.length] || colors[0] || '#3B82F6';

      const newGroup: PlayerGroup = {
        id: `group-${Date.now()}`,
        label: nextLabel,
        color: groupColor,
        playerIds,
        players: selectedPlayers
      };

      const updatedPlayers = prev.players.map(p =>
        playerIds.includes(p.id) ? { ...p, groupId: newGroup.id } : p
      );

      return {
        ...prev,
        playerGroups: [...prev.playerGroups, newGroup],
        players: updatedPlayers
      };
    });
  }, [setAppState]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    setAppState(prev => {
      const groupToDelete = prev.playerGroups.find(g => g.id === groupId);
      if (!groupToDelete) return prev;

      const updatedGroups = prev.playerGroups.filter(g => g.id !== groupId);
      const updatedPlayers = prev.players.map(p =>
        groupToDelete.playerIds.includes(p.id) ? { ...p, groupId: undefined } : p
      );

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, [setAppState]);

  const handleMergeGroups = useCallback((sourceGroupId: string, targetGroupId: string) => {
    setAppState(prev => {
      const sourceGroup = prev.playerGroups.find(g => g.id === sourceGroupId);
      const targetGroup = prev.playerGroups.find(g => g.id === targetGroupId);

      if (!sourceGroup || !targetGroup) return prev;

      const updatedPlayers = prev.players.map(player => {
        if (sourceGroup.playerIds.includes(player.id)) {
          return { ...player, groupId: targetGroupId };
        }
        return player;
      });

      const updatedGroups = prev.playerGroups.map(group => {
        if (group.id === targetGroupId) {
          return {
            ...group,
            playerIds: [...group.playerIds, ...sourceGroup.playerIds],
            players: [...group.players, ...sourceGroup.players]
          };
        }
        return group;
      }).filter(group => group.id !== sourceGroupId);

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, [setAppState]);

  return {
    handlePlayersLoaded,
    handleConfigChange,
    handleGenerateTeams,
    handlePlayerUpdate,
    handlePlayerAdd,
    handleResolveWarning,
    handleDismissWarning,
    handleDismissAllWarnings,
    handlePlayerRemove,
    handlePlayerMove,
    handleClearExecRankings,
    handleResetExecHistory,
    handleResetTeams,
    handleTeamNameChange,
    handleTeamBrandingChange,
    handleRefreshTeamBranding,
    handleAddTeam,
    handleRemoveTeam,
    handleAddPlayerToGroup,
    handleRemovePlayerFromGroup,
    handleCreateNewGroup,
    handleDeleteGroup,
    handleMergeGroups,
  };
}
