import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { toast } from 'sonner';

import { AppState, Player, SavedWorkspace } from '@/types';
import { getDefaultConfig } from '@/utils/configManager';
import { validateAppState, validatePlayer } from '@/utils/validation';
import { applyTeamBranding } from '@/utils/teamBranding';
import { dataStorageService } from '@/services/dataStorageService';
import { applyTeamIterationToState, ensureTeamIterations } from '@/utils/teamIterations';

const normalizeName = (name: string): string => name.trim().toLowerCase();

export interface WorkspaceSaveResult {
  id: string;
  type: 'cloud' | 'local';
  error?: unknown;
}

type PersistenceScope = 'device' | 'project';
type PersistencePhase = 'idle' | 'saving' | 'saved' | 'retrying' | 'error';
type PersistenceSurface = 'cloud' | 'local';

interface PersistenceSnapshot {
  phase: PersistencePhase;
  scope: PersistenceScope;
  surface: PersistenceSurface;
}

export interface PersistenceStatusModel {
  title: string;
  detail: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  icon: 'cloud' | 'local' | 'warning' | 'saving';
}

interface UseAppPersistenceOptions {
  user: User | null;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  currentWorkspaceId: string | null;
  workspaceName: string;
  workspaceDescription: string;
  saveWorkspace: (
    data: Partial<AppState>,
    options?: {
      id?: string | null;
      name?: string;
      description?: string;
      silent?: boolean;
      refreshList?: boolean;
    }
  ) => Promise<WorkspaceSaveResult | undefined>;
}

function buildExecRatingHistory(players: Player[], existingHistory?: AppState['execRatingHistory']) {
  const execHistory = { ...(existingHistory ?? {}) };
  const migratedHistory: Record<string, { rating: number; updatedAt: number }> = {};

  Object.entries(execHistory).forEach(([key, val]) => {
    if (typeof val === 'number') {
      migratedHistory[key] = { rating: val, updatedAt: 0 };
    } else if (val && typeof val === 'object' && 'rating' in val) {
      const historyEntry = val as { rating: number; updatedAt?: number };
      migratedHistory[key] = {
        rating: historyEntry.rating,
        updatedAt: historyEntry.updatedAt ?? 0,
      };
    }
  });

  players.forEach(player => {
    if (player.execSkillRating !== null) {
      const key = normalizeName(player.name);
      if (!migratedHistory[key]) {
        migratedHistory[key] = { rating: player.execSkillRating, updatedAt: 0 };
      }
    }
  });

  return migratedHistory;
}

function sanitizeLoadedState(loadedState: AppState): AppState | null {
  if (!validateAppState(loadedState)) {
    return null;
  }

  const validatedPlayers = loadedState.players
    .map(player => validatePlayer(player))
    .filter((player): player is Player => player !== null);

  return {
    ...loadedState,
    players: validatedPlayers,
    config: loadedState.config || getDefaultConfig(),
    execRatingHistory: buildExecRatingHistory(validatedPlayers, loadedState.execRatingHistory),
    ...(() => {
      const normalized = ensureTeamIterations({
        ...loadedState,
        players: validatedPlayers,
        config: loadedState.config || getDefaultConfig(),
      });

      return applyTeamIterationToState({
        ...loadedState,
        players: validatedPlayers,
        config: loadedState.config || getDefaultConfig(),
        teams: applyTeamBranding(loadedState.teams || [], loadedState.playerGroups || [], loadedState.config || getDefaultConfig()),
        teamIterations: normalized.teamIterations,
        activeTeamIterationId: normalized.activeTeamIterationId,
      }, normalized.activeTeamIterationId);
    })(),
  };
}

export function describePersistenceStatus(
  snapshot: PersistenceSnapshot,
  user: User | null,
  hasProject: boolean
): PersistenceStatusModel {
  const scopeLabel = hasProject ? 'project' : 'changes';

  if (snapshot.phase === 'saving') {
    return {
      title: snapshot.surface === 'cloud' ? 'Saving to cloud' : 'Saving locally',
      detail: snapshot.surface === 'cloud'
        ? `Syncing ${scopeLabel} now`
        : user
          ? 'Keeping a local copy safe'
          : 'Not signed in',
      tone: 'neutral',
      icon: 'saving',
    };
  }

  if (snapshot.phase === 'retrying') {
    return {
      title: 'Saved locally',
      detail: 'Cloud unavailable — retrying',
      tone: 'warning',
      icon: 'warning',
    };
  }

  if (snapshot.phase === 'error') {
    return {
      title: 'Save failed',
      detail: user ? 'Please try saving again' : 'Local save needs attention',
      tone: 'danger',
      icon: 'warning',
    };
  }

  if (!user) {
    return {
      title: snapshot.phase === 'saved' ? 'Saved locally' : 'Not signed in',
      detail: 'Changes stay on this device',
      tone: snapshot.phase === 'saved' ? 'warning' : 'neutral',
      icon: 'local',
    };
  }

  if (snapshot.surface === 'cloud' && snapshot.phase === 'saved') {
    return {
      title: 'Saved to cloud',
      detail: hasProject ? 'Project autosync is on' : 'Account sync is active',
      tone: 'success',
      icon: 'cloud',
    };
  }

  if (snapshot.surface === 'local' && snapshot.phase === 'saved') {
    return {
      title: 'Saved locally',
      detail: 'Local backup is up to date',
      tone: 'warning',
      icon: 'local',
    };
  }

  return {
    title: hasProject ? 'Project ready' : 'Sync ready',
    detail: hasProject ? 'Project will autosave' : 'Cloud sync is available',
    tone: 'neutral',
    icon: user ? 'cloud' : 'local',
  };
}

export function useAppPersistence({
  user,
  appState,
  setAppState,
  currentWorkspaceId,
  workspaceName,
  workspaceDescription,
  saveWorkspace,
}: UseAppPersistenceOptions) {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [persistenceSnapshot, setPersistenceSnapshot] = useState<PersistenceSnapshot>({
    phase: 'idle',
    scope: 'device',
    surface: 'local',
  });

  useEffect(() => {
    let isMounted = true;

    setDataLoaded(false);
    dataStorageService.setUser(user);

    const loadData = async () => {
      try {
        const loadedState = await dataStorageService.load();
        if (!isMounted || !loadedState) {
          return;
        }

        const sanitizedState = sanitizeLoadedState(loadedState);
        if (sanitizedState) {
          setAppState(sanitizedState);
        } else {
          console.warn('Invalid saved state structure');
          toast.warning('Some saved data was invalid and has been cleaned up');
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load saved data');
      } finally {
        if (isMounted) {
          setDataLoaded(true);
          setPersistenceSnapshot({
            phase: 'idle',
            scope: 'device',
            surface: user ? 'cloud' : 'local',
          });
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [user, setAppState]);

  useEffect(() => {
    if (!dataLoaded) {
      return undefined;
    }

    setPersistenceSnapshot({
      phase: 'saving',
      scope: 'device',
      surface: user ? 'cloud' : 'local',
    });

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await dataStorageService.save(appState);
        if (result.type === 'cloud') {
          setPersistenceSnapshot({
            phase: 'saved',
            scope: 'device',
            surface: 'cloud',
          });
          return;
        }

        if (result.error && user) {
          console.warn('Auto-saved to local only due to error:', result.error);
          setPersistenceSnapshot({
            phase: 'retrying',
            scope: 'device',
            surface: 'local',
          });
          return;
        }

        setPersistenceSnapshot({
          phase: 'saved',
          scope: 'device',
          surface: 'local',
        });
      } catch (error) {
        console.error('Failed to save data:', error);
        setPersistenceSnapshot({
          phase: 'error',
          scope: 'device',
          surface: user ? 'cloud' : 'local',
        });
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [appState, dataLoaded, user]);

  useEffect(() => {
    if (!currentWorkspaceId || !user || !workspaceName.trim()) {
      return undefined;
    }

    setPersistenceSnapshot({
      phase: 'saving',
      scope: 'project',
      surface: 'cloud',
    });

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await saveWorkspace({
          players: appState.players,
          playerGroups: appState.playerGroups,
          config: appState.config,
          teams: appState.teams,
          unassignedPlayers: appState.unassignedPlayers,
          stats: appState.stats,
          teamIterations: appState.teamIterations,
          activeTeamIterationId: appState.activeTeamIterationId,
        }, {
          id: currentWorkspaceId,
          name: workspaceName,
          description: workspaceDescription,
          silent: true,
          refreshList: false,
        });

        if (!result) {
          return;
        }

        setPersistenceSnapshot({
          phase: result.type === 'local' ? 'retrying' : 'saved',
          scope: 'project',
          surface: result.type,
        });
      } catch (error) {
        console.error('Auto-save failed:', error);
        setPersistenceSnapshot({
          phase: 'error',
          scope: 'project',
          surface: 'cloud',
        });
      }
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [
    appState,
    currentWorkspaceId,
    saveWorkspace,
    user,
    workspaceDescription,
    workspaceName,
  ]);

  const applyLoadedWorkspace = useCallback((workspace: SavedWorkspace) => {
    setAppState(prev => {
      const normalized = ensureTeamIterations({
        ...workspace,
        players: workspace.players || [],
        config: workspace.config || getDefaultConfig(),
      });

      return applyTeamIterationToState({
        ...prev,
        players: workspace.players || [],
        playerGroups: workspace.playerGroups || [],
        config: workspace.config || getDefaultConfig(),
        teams: applyTeamBranding(workspace.teams || [], workspace.playerGroups || [], workspace.config || getDefaultConfig()),
        unassignedPlayers: workspace.unassignedPlayers || [],
        stats: workspace.stats,
        teamIterations: normalized.teamIterations,
        activeTeamIterationId: normalized.activeTeamIterationId,
        execRatingHistory: buildExecRatingHistory(workspace.players || [], prev.execRatingHistory),
      }, normalized.activeTeamIterationId);
    });
  }, [setAppState]);

  const restoreImportedState = useCallback((importedState: AppState) => {
    const sanitizedState = sanitizeLoadedState(importedState);

    if (!sanitizedState) {
      throw new Error('This backup file does not contain a valid project state.');
    }

    setAppState(sanitizedState);
    setPersistenceSnapshot({
      phase: 'saved',
      scope: 'device',
      surface: 'local',
    });
  }, [setAppState]);

  const syncWorkspaceSaveStatus = useCallback((result?: WorkspaceSaveResult) => {
    if (!result) {
      return;
    }

    setPersistenceSnapshot({
      phase: result.type === 'local' ? 'retrying' : 'saved',
      scope: 'project',
      surface: result.type,
    });
  }, []);

  const persistenceStatus = useMemo(
    () => describePersistenceStatus(persistenceSnapshot, user, Boolean(currentWorkspaceId)),
    [currentWorkspaceId, persistenceSnapshot, user]
  );

  return {
    dataLoaded,
    persistenceStatus,
    applyLoadedWorkspace,
    restoreImportedState,
    syncWorkspaceSaveStatus,
  };
}
