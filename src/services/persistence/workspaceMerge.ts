import type {
  AppState,
  LeagueConfig,
  LeagueMemoryEntry,
  SavedWorkspace,
  StructuredWarning,
  TeamIteration,
} from '@/types';

function mergeById<T extends { id: string }>(localItems: T[] = [], remoteItems: T[] = []): T[] {
  const merged = new Map<string, T>();

  remoteItems.forEach(item => merged.set(item.id, item));
  localItems.forEach(item => merged.set(item.id, item));

  return Array.from(merged.values());
}

function mergeExecRatingHistory(
  localHistory: AppState['execRatingHistory'] = {},
  remoteHistory: AppState['execRatingHistory'] = {},
): AppState['execRatingHistory'] {
  const merged = { ...remoteHistory };

  Object.entries(localHistory).forEach(([key, value]) => {
    const existing = merged[key];
    if (!existing || value.updatedAt >= existing.updatedAt) {
      merged[key] = value;
    }
  });

  return merged;
}

function mergePendingWarnings(
  localWarnings: StructuredWarning[] = [],
  remoteWarnings: StructuredWarning[] = [],
): StructuredWarning[] {
  return mergeById(localWarnings, remoteWarnings);
}

function mergeTeamIterations(
  localIterations: TeamIteration[] = [],
  remoteIterations: TeamIteration[] = [],
): TeamIteration[] {
  return mergeById(localIterations, remoteIterations);
}

function mergeLeagueMemory(
  localMemory: LeagueMemoryEntry[] = [],
  remoteMemory: LeagueMemoryEntry[] = [],
): LeagueMemoryEntry[] {
  return mergeById(localMemory, remoteMemory);
}

function mergeSavedConfigs(
  localConfigs: LeagueConfig[] = [],
  remoteConfigs: LeagueConfig[] = [],
): LeagueConfig[] {
  return mergeById(localConfigs, remoteConfigs);
}

export function mergeWorkspaceStateForConflict(
  latestRemoteWorkspace: SavedWorkspace,
  localState: AppState,
): AppState {
  return {
    ...localState,
    execRatingHistory: mergeExecRatingHistory(localState.execRatingHistory, latestRemoteWorkspace.execRatingHistory),
    savedConfigs: mergeSavedConfigs(localState.savedConfigs, latestRemoteWorkspace.savedConfigs),
    teamIterations: mergeTeamIterations(localState.teamIterations || [], latestRemoteWorkspace.teamIterations || []),
    activeTeamIterationId: localState.activeTeamIterationId ?? latestRemoteWorkspace.activeTeamIterationId ?? null,
    leagueMemory: mergeLeagueMemory(localState.leagueMemory || [], latestRemoteWorkspace.leagueMemory || []),
    pendingWarnings: mergePendingWarnings(localState.pendingWarnings || [], latestRemoteWorkspace.pendingWarnings || []),
  };
}
