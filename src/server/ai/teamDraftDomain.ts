import type { AIPlayerInput, AITeamDraftPayload } from '../../shared/ai-contracts.js';

interface DraftTeamLike {
  players: Array<{ id: string }>;
}

interface DraftPlayerLike {
  id: string;
}

export function cloneTeamDraft(draft: AITeamDraftPayload): AITeamDraftPayload {
  return {
    source: draft.source,
    summary: draft.summary,
    requestedModel: draft.requestedModel,
    model: draft.model,
    responseId: draft.responseId,
    responseIds: [...(draft.responseIds ?? [])],
    teams: draft.teams.map(team => ({
      slot: team.slot,
      playerIds: [...team.playerIds],
    })),
    unassignedPlayerIds: [...(draft.unassignedPlayerIds ?? [])],
  };
}

export function buildDraftPayload(
  teams: DraftTeamLike[],
  unassignedPlayers: DraftPlayerLike[],
  expectedTeamCount: number
): AITeamDraftPayload {
  const normalizedTeams = Array.from({ length: expectedTeamCount }, (_, index) => ({
    slot: index + 1,
    playerIds: teams[index]?.players.map(player => player.id) ?? [],
  }));

  return {
    teams: normalizedTeams,
    unassignedPlayerIds: unassignedPlayers.map(player => player.id),
  };
}

export function buildDraftSnapshot(
  draft: AITeamDraftPayload,
  players: AIPlayerInput[]
) {
  const playersById = new Map(players.map(player => [player.id, player]));

  return {
    teams: draft.teams.map(team => {
      const assignedPlayers = team.playerIds
        .map(playerId => playersById.get(playerId))
        .filter((player): player is AIPlayerInput => Boolean(player));

      const totalSkill = assignedPlayers.reduce((sum, player) => sum + (player.execSkillRating ?? player.skillRating), 0);
      const femaleCount = assignedPlayers.filter(player => player.gender === 'F').length;
      const maleCount = assignedPlayers.filter(player => player.gender === 'M').length;
      const handlerCount = assignedPlayers.filter(player => player.isHandler).length;

      return {
        slot: team.slot,
        playerIds: team.playerIds,
        playerNames: assignedPlayers.map(player => player.name),
        size: team.playerIds.length,
        averageSkill: assignedPlayers.length > 0 ? Number((totalSkill / assignedPlayers.length).toFixed(2)) : 0,
        femaleCount,
        maleCount,
        handlerCount,
      };
    }),
    unassignedPlayerIds: draft.unassignedPlayerIds ?? [],
  };
}

export function getDraftBucketIds(teamCount: number): string[] {
  return ['unassigned', ...Array.from({ length: teamCount }, (_, index) => `team-${index + 1}`)];
}

export function getDraftBucketPlayers(draft: AITeamDraftPayload, bucketId: string): string[] | null {
  if (bucketId === 'unassigned') {
    return draft.unassignedPlayerIds ?? [];
  }

  const match = /^team-(\d+)$/.exec(bucketId);
  if (!match) {
    return null;
  }

  const slot = Number(match[1]);
  return draft.teams.find(team => team.slot === slot)?.playerIds ?? null;
}
