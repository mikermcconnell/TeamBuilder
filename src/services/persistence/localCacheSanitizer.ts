import type { AppState, Player, PlayerGroup, SavedWorkspace, Team } from '@/types';

function sanitizePlayerProfileForLocalCache(player: Player): Player['profile'] {
  const age = player.profile?.age ?? player.age;

  if (age === undefined) {
    return undefined;
  }

  return { age };
}

export function sanitizePlayerForLocalCache(player: Player): Player {
  return {
    ...player,
    email: undefined,
    profile: sanitizePlayerProfileForLocalCache(player),
    registrationInfo: undefined,
    experienceNotes: undefined,
    age: undefined,
  };
}

function sanitizeTeamForLocalCache(team: Team): Team {
  return {
    ...team,
    players: team.players.map(sanitizePlayerForLocalCache),
  };
}

function sanitizeGroupForLocalCache(group: PlayerGroup): PlayerGroup {
  return {
    ...group,
    players: group.players.map(sanitizePlayerForLocalCache),
  };
}

export function sanitizeAppStateForLocalCache(state: AppState): AppState {
  return {
    ...state,
    players: state.players.map(sanitizePlayerForLocalCache),
    teams: state.teams.map(sanitizeTeamForLocalCache),
    unassignedPlayers: state.unassignedPlayers.map(sanitizePlayerForLocalCache),
    playerGroups: state.playerGroups.map(sanitizeGroupForLocalCache),
  };
}

export function sanitizeWorkspaceForLocalCache(workspace: SavedWorkspace): SavedWorkspace {
  return {
    ...workspace,
    players: workspace.players.map(sanitizePlayerForLocalCache),
    teams: workspace.teams.map(sanitizeTeamForLocalCache),
    unassignedPlayers: workspace.unassignedPlayers.map(sanitizePlayerForLocalCache),
    playerGroups: workspace.playerGroups.map(sanitizeGroupForLocalCache),
  };
}
