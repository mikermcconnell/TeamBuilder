import type { LeagueConfig, Player, PlayerGroup, Team, TeamGenerationStats, TeammateRequest, UnfulfilledRequest } from '@/types';
import { getEffectiveSkillRating } from '@/types';
import { buildGenerationResult } from '@/utils/teamGenerator';
import { detectRequestConflicts, findPlayerByName, namesMatch } from '@/utils/playerGrouping';

interface ReconciledTeamState {
  players: Player[];
  teams: Team[];
  unassignedPlayers: Player[];
  stats: TeamGenerationStats | undefined;
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    profile: player.profile ? { ...player.profile } : undefined,
    teammateRequests: [...(player.teammateRequests ?? [])],
    avoidRequests: [...(player.avoidRequests ?? [])],
    teammateRequestsParsed: player.teammateRequestsParsed?.map(request => ({ ...request })),
    unfulfilledRequests: player.unfulfilledRequests?.map(request => ({ ...request })),
  };
}

function rebuildTeam(team: Team, playersById: Map<string, Player>): Team {
  const reconciledPlayers = (team.players ?? [])
    .map(player => playersById.get(player.id))
    .filter((player): player is Player => Boolean(player));

  const genderBreakdown = { M: 0, F: 0, Other: 0 };
  let handlerCount = 0;
  const totalSkill = reconciledPlayers.reduce((sum, player) => {
    genderBreakdown[player.gender] += 1;
    if (player.isHandler) {
      handlerCount += 1;
    }
    return sum + getEffectiveSkillRating(player);
  }, 0);

  return {
    ...team,
    players: reconciledPlayers,
    averageSkill: reconciledPlayers.length > 0 ? totalSkill / reconciledPlayers.length : 0,
    genderBreakdown,
    handlerCount,
  };
}

function buildAssignmentMap(teams: Team[], unassignedPlayers: Player[]) {
  const assignmentMap = new Map<string, string | null>();

  teams.forEach(team => {
    team.players.forEach(player => {
      assignmentMap.set(player.id, team.id);
    });
  });

  unassignedPlayers.forEach(player => {
    assignmentMap.set(player.id, null);
  });

  return assignmentMap;
}

function refreshParsedRequests(players: Player[], assignmentMap: Map<string, string | null>) {
  const conflicts = detectRequestConflicts(players);
  const playersById = new Map(players.map(player => [player.id, player]));

  players.forEach(player => {
    const playerTeamId = assignmentMap.get(player.id) ?? null;
    const existingParsedRequests = player.teammateRequestsParsed ?? [];

    const refreshedParsedRequests: TeammateRequest[] = (player.teammateRequests ?? []).map((requestedName, index) => {
      const previousParsed = existingParsedRequests.find(request =>
        request.name === requestedName
        || (request.matchedPlayerId && playersById.get(request.matchedPlayerId)?.name === requestedName)
      );

      const matchedPlayer = previousParsed?.matchedPlayerId
        ? playersById.get(previousParsed.matchedPlayerId) ?? findPlayerByName(players, requestedName)
        : findPlayerByName(players, requestedName);

      const matchedPlayerId = matchedPlayer?.id;
      const requestedPlayerTeamId = matchedPlayerId ? (assignmentMap.get(matchedPlayerId) ?? null) : null;
      const honored = Boolean(playerTeamId && requestedPlayerTeamId && playerTeamId === requestedPlayerTeamId);
      const hasConflict = Boolean(
        matchedPlayerId
        && conflicts.some(conflict =>
          conflict.playerId === player.id
          && conflict.requestedPlayerId === matchedPlayerId
          && conflict.conflictType === 'avoid-vs-request'
        )
      );

      return {
        name: requestedName,
        priority: index === 0 ? 'must-have' : 'nice-to-have',
        matchedPlayerId,
        status: honored ? 'honored' : hasConflict ? 'conflict' : 'unfulfilled',
        reason: honored ? undefined : hasConflict ? 'Conflict with avoid request' : undefined,
      };
    });

    const refreshedUnfulfilledRequests: UnfulfilledRequest[] = [];

    refreshedParsedRequests.forEach(parsedRequest => {
      if (!parsedRequest.matchedPlayerId || parsedRequest.status === 'honored') {
        return;
      }

      const matchedPlayer = playersById.get(parsedRequest.matchedPlayerId);
      if (!matchedPlayer) {
        return;
      }

      const hasConflict = conflicts.some(conflict =>
        conflict.playerId === player.id
        && conflict.requestedPlayerId === matchedPlayer.id
        && conflict.conflictType === 'avoid-vs-request'
      );
      const isMutual = matchedPlayer.teammateRequests.some(requestedName => namesMatch(requestedName, player.name));

      refreshedUnfulfilledRequests.push({
        playerId: matchedPlayer.id,
        name: matchedPlayer.name,
        reason: hasConflict ? 'conflict' : isMutual ? 'group-full' : 'non-reciprocal',
        priority: parsedRequest.priority,
      });
    });

    player.teammateRequestsParsed = refreshedParsedRequests;
    player.unfulfilledRequests = refreshedUnfulfilledRequests;
  });
}

export function reconcileTeamState(
  players: Player[],
  teams: Team[],
  unassignedPlayers: Player[],
  playerGroups: PlayerGroup[],
  config: LeagueConfig,
  previousStats?: TeamGenerationStats,
): ReconciledTeamState {
  const reconciledPlayers = players.map(clonePlayer);
  const playersById = new Map(reconciledPlayers.map(player => [player.id, player]));
  const reconciledTeams = teams.map(team => ({
    ...team,
    players: (team.players ?? [])
      .map(teamPlayer => playersById.get(teamPlayer.id))
      .filter((player): player is Player => Boolean(player)),
  }));
  const reconciledUnassignedPlayers = unassignedPlayers
    .map(player => playersById.get(player.id))
    .filter((player): player is Player => Boolean(player));

  const assignmentMap = buildAssignmentMap(reconciledTeams, reconciledUnassignedPlayers);

  reconciledPlayers.forEach(player => {
    const assignedTeamId = assignmentMap.get(player.id);
    player.teamId = assignedTeamId ?? undefined;
  });

  refreshParsedRequests(reconciledPlayers, assignmentMap);

  const updatedPlayersById = new Map(reconciledPlayers.map(player => [player.id, player]));
  const updatedTeams = reconciledTeams.map(team => rebuildTeam(team, updatedPlayersById));
  const updatedUnassignedPlayers = reconciledUnassignedPlayers
    .map(player => updatedPlayersById.get(player.id))
    .filter((player): player is Player => Boolean(player));

  const generatedAt = previousStats?.generationTime ?? 0;
  const stats = buildGenerationResult(
    reconciledPlayers,
    updatedTeams.map(team => ({
      ...team,
      players: team.players.map(player => updatedPlayersById.get(player.id) ?? player),
    })),
    updatedUnassignedPlayers,
    config,
    playerGroups,
    Date.now() - generatedAt,
  ).stats;

  return {
    players: reconciledPlayers,
    teams: updatedTeams,
    unassignedPlayers: updatedUnassignedPlayers,
    stats,
  };
}
