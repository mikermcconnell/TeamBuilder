import { Player, Team, LeagueConfig, PlayerGroup } from '@/types';
import { fuzzyMatcher } from '@/utils/fuzzyNameMatcher';

import type { AITeamDraftPayload } from './ai-contracts';

export interface AITeamDraftValidationResult {
  valid: boolean;
  errors: string[];
}

export function calculateAverageSkillByGender(players: Player[]) {
  const groups: Record<'M' | 'F' | 'Other', number[]> = {
    M: [],
    F: [],
    Other: [],
  };

  players.forEach(player => {
    groups[player.gender].push(player.execSkillRating ?? player.skillRating);
  });

  return {
    M: groups.M.length > 0 ? Number((groups.M.reduce((sum, value) => sum + value, 0) / groups.M.length).toFixed(2)) : null,
    F: groups.F.length > 0 ? Number((groups.F.reduce((sum, value) => sum + value, 0) / groups.F.length).toFixed(2)) : null,
    Other: groups.Other.length > 0 ? Number((groups.Other.reduce((sum, value) => sum + value, 0) / groups.Other.length).toFixed(2)) : null,
  };
}

export function cleanJsonResponse(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

export function parseAiTeamDraftResponse(text: string): AITeamDraftPayload | null {
  const cleanJson = cleanJsonResponse(text);

  try {
    const parsed = JSON.parse(cleanJson) as AITeamDraftPayload;
    if (!parsed || !Array.isArray(parsed.teams)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function calculateTeamStats(team: Team): Team {
  const totalSkill = team.players.reduce((sum, player) => sum + (player.execSkillRating ?? player.skillRating), 0);
  const genderBreakdown = { M: 0, F: 0, Other: 0 };
  let handlerCount = 0;

  team.players.forEach(player => {
    genderBreakdown[player.gender]++;
    if (player.isHandler) {
      handlerCount += 1;
    }
  });

  return {
    ...team,
    averageSkill: team.players.length > 0 ? totalSkill / team.players.length : 0,
    genderBreakdown,
    handlerCount,
  };
}

export function buildTeamsFromDraft(
  payload: AITeamDraftPayload,
  players: Player[],
  seedTeams: Team[]
): { teams: Team[]; unassignedPlayers: Player[] } {
  const playerMap = new Map(players.map(player => [player.id, player]));
  const teams = payload.teams.map((teamDraft, index) => {
    const seedTeam = seedTeams[index];
    const teamPlayers = teamDraft.playerIds
      .map(playerId => playerMap.get(playerId))
      .filter((player): player is Player => Boolean(player))
      .map(player => ({ ...player, teamId: seedTeam?.id }));

    return calculateTeamStats({
      id: seedTeam?.id || `team-${index + 1}`,
      name: seedTeam?.name || `Team ${index + 1}`,
      color: seedTeam?.color,
      colorName: seedTeam?.colorName,
      players: teamPlayers,
      averageSkill: 0,
      genderBreakdown: { M: 0, F: 0, Other: 0 },
      handlerCount: 0,
      isNameEditable: true,
    });
  });

  const assignedIds = new Set(teams.flatMap(team => team.players.map(player => player.id)));
  const unassignedIds = payload.unassignedPlayerIds ?? [];
  const unassignedPlayers = unassignedIds
    .map(playerId => playerMap.get(playerId))
    .filter((player): player is Player => Boolean(player))
    .map(player => ({ ...player, teamId: undefined }));

  players.forEach(player => {
    if (!assignedIds.has(player.id) && !unassignedIds.includes(player.id)) {
      unassignedPlayers.push({ ...player, teamId: undefined });
    }
  });

  return {
    teams,
    unassignedPlayers,
  };
}

export function validateAiTeamDraft(
  payload: AITeamDraftPayload,
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[]
): AITeamDraftValidationResult {
  const errors: string[] = [];
  const expectedTeamCount = config.targetTeams || Math.ceil(players.length / config.maxTeamSize);
  const playerIds = new Set(players.map(player => player.id));
  const assignedIds = new Set<string>();
  const destinationByPlayer = new Map<string, string>();

  if (!Array.isArray(payload.teams) || payload.teams.length !== expectedTeamCount) {
    errors.push(`Expected exactly ${expectedTeamCount} teams in the AI response.`);
    return { valid: false, errors };
  }

  const normalizedUnassigned = new Set(payload.unassignedPlayerIds ?? []);

  payload.teams.forEach((team, index) => {
    if (team.slot !== index + 1) {
      errors.push('AI team slots must be sequential and start at 1.');
    }

    if (!Array.isArray(team.playerIds)) {
      errors.push(`Team slot ${index + 1} is missing a playerIds array.`);
      return;
    }

    if (team.playerIds.length > config.maxTeamSize) {
      errors.push(`Team slot ${index + 1} exceeds the max team size.`);
    }

    team.playerIds.forEach(playerId => {
      if (!playerIds.has(playerId)) {
        errors.push(`Unknown player id "${playerId}" returned by AI.`);
        return;
      }

      if (assignedIds.has(playerId) || normalizedUnassigned.has(playerId)) {
        errors.push(`Player "${playerId}" was assigned more than once.`);
        return;
      }

      assignedIds.add(playerId);
      destinationByPlayer.set(playerId, `team-${team.slot}`);
    });
  });

  normalizedUnassigned.forEach(playerId => {
    if (!playerIds.has(playerId)) {
      errors.push(`Unknown unassigned player id "${playerId}" returned by AI.`);
      return;
    }

    if (assignedIds.has(playerId)) {
      errors.push(`Player "${playerId}" appears in both a team and the unassigned list.`);
      return;
    }

    assignedIds.add(playerId);
    destinationByPlayer.set(playerId, 'unassigned');
  });

  if (assignedIds.size !== players.length) {
    errors.push('AI response did not account for every player exactly once.');
  }

  playerGroups.forEach(group => {
    const destinations = new Set(
      group.playerIds
        .map(playerId => destinationByPlayer.get(playerId))
        .filter((destination): destination is string => Boolean(destination))
    );

    if (destinations.size > 1) {
      errors.push(`Group ${group.label} was split across multiple destinations.`);
    }
  });

  payload.teams.forEach(team => {
    const teamPlayers = team.playerIds
      .map(playerId => players.find(player => player.id === playerId))
      .filter((player): player is Player => Boolean(player));

    const femaleCount = teamPlayers.filter(player => player.gender === 'F').length;
    const maleCount = teamPlayers.filter(player => player.gender === 'M').length;

    if (femaleCount < config.minFemales) {
      errors.push(`Team slot ${team.slot} does not meet the minimum female requirement.`);
    }

    if (maleCount < config.minMales) {
      errors.push(`Team slot ${team.slot} does not meet the minimum male requirement.`);
    }

    for (const player of teamPlayers) {
      const hasAvoidConflict = teamPlayers.some(otherPlayer => (
        otherPlayer.id !== player.id
        && (
          player.avoidRequests.some(name => fuzzyMatcher.isLikelyMatch(name, otherPlayer.name, 0.8))
          || otherPlayer.avoidRequests.some(name => fuzzyMatcher.isLikelyMatch(name, player.name, 0.8))
        )
      ));

      if (hasAvoidConflict) {
        errors.push(`Team slot ${team.slot} contains at least one avoid conflict.`);
        break;
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
