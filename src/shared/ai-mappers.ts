import type {
  AILeagueConfigInput,
  AIPlayerGroupInput,
  AIPlayerInput,
  AITeamInput,
} from '@/shared/ai-contracts';
import type { LeagueConfig, Player, PlayerGroup, Team } from '@/types';

export function toAIPlayerInput(player: Player): AIPlayerInput {
  return {
    id: player.id,
    name: player.name,
    gender: player.gender,
    skillRating: player.skillRating,
    execSkillRating: player.execSkillRating,
    isHandler: player.isHandler,
    teammateRequests: [...player.teammateRequests],
    avoidRequests: [...player.avoidRequests],
    teamId: player.teamId,
    groupId: player.groupId,
  };
}

export function toAITeamInput(team: Team): AITeamInput {
  return {
    id: team.id,
    name: team.name,
    players: team.players.map(player => ({ id: player.id })),
    averageSkill: team.averageSkill,
    genderBreakdown: { ...team.genderBreakdown },
    handlerCount: team.handlerCount,
  };
}

export function toAILeagueConfigInput(config: LeagueConfig): AILeagueConfigInput {
  return { ...config };
}

export function toAIPlayerGroupInput(group: PlayerGroup): AIPlayerGroupInput {
  return {
    id: group.id,
    label: group.label,
    playerIds: [...group.playerIds],
  };
}

export function toDomainPlayer(player: AIPlayerInput): Player {
  return {
    id: player.id,
    name: player.name,
    gender: player.gender,
    skillRating: player.skillRating,
    execSkillRating: player.execSkillRating,
    teammateRequests: [...player.teammateRequests],
    avoidRequests: [...player.avoidRequests],
    isHandler: player.isHandler,
    teamId: player.teamId,
    groupId: player.groupId,
  };
}

export function toDomainLeagueConfig(config: AILeagueConfigInput): LeagueConfig {
  return {
    ...config,
  };
}

export function toDomainPlayerGroup(
  group: AIPlayerGroupInput,
  players: Player[],
  color = '#000000'
): PlayerGroup {
  const playerMap = new Map(players.map(player => [player.id, player]));

  return {
    id: group.id,
    label: group.label,
    color,
    playerIds: [...group.playerIds],
    players: group.playerIds
      .map(playerId => playerMap.get(playerId))
      .filter((player): player is Player => Boolean(player)),
  };
}

export function toDomainPlayerGroups(
  groups: AIPlayerGroupInput[],
  players: Player[],
  color = '#000000'
): PlayerGroup[] {
  return groups.map(group => toDomainPlayerGroup(group, players, color));
}
