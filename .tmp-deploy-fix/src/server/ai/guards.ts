import { z } from 'zod';

import {
  getEffectiveSkillRating,
  type Player,
  type Team,
} from '@/types';
import { fuzzyMatcher } from '@/utils/fuzzyNameMatcher';
import type {
  AILeagueConfigInput,
  AIPlayerGroupInput,
  AIPlayerInput,
  AITeamInput,
  GroupSuggestionsRequest,
  NameMatchDto,
  NameMatchRequest,
  SuggestedGroupDto,
  TeamDestinationId,
  TeamDraftRequest,
  TeamSuggestionAction,
  TeamSuggestionDto,
  TeamSuggestionsRequest,
} from '@/shared/ai-contracts';

const aiPlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(['M', 'F', 'Other']),
  skillRating: z.number(),
  execSkillRating: z.number().nullable(),
  isHandler: z.boolean().optional(),
  teammateRequests: z.array(z.string()),
  avoidRequests: z.array(z.string()),
  teamId: z.string().optional(),
  groupId: z.string().optional(),
});

const aiTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  players: z.array(z.object({ id: z.string().min(1) })),
  averageSkill: z.number(),
  genderBreakdown: z.object({
    M: z.number(),
    F: z.number(),
    Other: z.number(),
  }),
  handlerCount: z.number().optional(),
});

const aiLeagueConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maxTeamSize: z.number().int().positive(),
  minFemales: z.number().int().nonnegative(),
  minMales: z.number().int().nonnegative(),
  targetTeams: z.number().int().positive().optional(),
  allowMixedGender: z.boolean(),
  restrictToEvenTeams: z.boolean().optional(),
});

const aiPlayerGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  playerIds: z.array(z.string().min(1)),
});

const teamSuggestionActionSchema = z.object({
  playerId: z.string().min(1),
  sourceTeamId: z.string().min(1),
  targetTeamId: z.string().min(1),
});

const teamSuggestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['move', 'swap']),
  title: z.string().min(1),
  reasoning: z.string().min(1),
  actions: z.array(teamSuggestionActionSchema).min(1),
});

const nameMatchSchema = z.object({
  requested: z.string().min(1),
  matched: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

const groupSuggestionSchema = z.object({
  id: z.string().min(1),
  playerIds: z.array(z.string().min(1)).min(2).max(4),
  playerNames: z.array(z.string().min(1)).min(2).max(4),
  avgSkill: z.number().nonnegative().optional(),
  reasoning: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const teamSuggestionsRequestSchema = z.object({
  prompt: z.string().min(1),
  players: z.array(aiPlayerSchema),
  teams: z.array(aiTeamSchema),
  config: aiLeagueConfigSchema,
  playerGroups: z.array(aiPlayerGroupSchema),
});

export const nameMatchRequestSchema = z.object({
  rosterNames: z.array(z.string().min(1)),
  requestedNames: z.array(z.string().min(1)),
});

export const groupSuggestionsRequestSchema = z.object({
  players: z.array(aiPlayerSchema),
  existingGroups: z.array(aiPlayerGroupSchema),
});

export const teamDraftRequestSchema = z.object({
  players: z.array(aiPlayerSchema),
  config: aiLeagueConfigSchema,
  playerGroups: z.array(aiPlayerGroupSchema),
  variant: z.enum(['primary', 'alternate']).optional(),
});

function normalizeTeamId(teamId: TeamDestinationId): string {
  return teamId;
}

function buildPlayerTeamMap(
  players: AIPlayerInput[],
  teams: AITeamInput[]
): Map<string, string> {
  const playerTeamMap = new Map<string, string>();

  teams.forEach(team => {
    team.players.forEach(player => {
      playerTeamMap.set(player.id, team.id);
    });
  });

  players.forEach(player => {
    if (!playerTeamMap.has(player.id)) {
      playerTeamMap.set(player.id, 'unassigned');
    }
  });

  return playerTeamMap;
}

function buildSimulatedTeams(
  players: AIPlayerInput[],
  teams: AITeamInput[],
  actions: TeamSuggestionAction[]
): Map<string, AIPlayerInput[]> {
  const teamMap = new Map<string, AIPlayerInput[]>();
  const playerMap = new Map(players.map(player => [player.id, player]));

  teams.forEach(team => {
    teamMap.set(team.id, team.players
      .map(player => playerMap.get(player.id))
      .filter((player): player is AIPlayerInput => Boolean(player)));
  });
  teamMap.set('unassigned', players.filter(player => !teams.some(team => team.players.some(teamPlayer => teamPlayer.id === player.id))));

  actions.forEach(action => {
    const player = playerMap.get(action.playerId);
    if (!player) {
      return;
    }

    const sourceTeam = teamMap.get(action.sourceTeamId) ?? [];
    const targetTeam = teamMap.get(action.targetTeamId) ?? [];

    teamMap.set(action.sourceTeamId, sourceTeam.filter(existing => existing.id !== action.playerId));
    teamMap.set(action.targetTeamId, [...targetTeam.filter(existing => existing.id !== action.playerId), player]);
  });

  return teamMap;
}

function hasAvoidConflict(players: AIPlayerInput[]): boolean {
  return players.some(player => players.some(otherPlayer => (
    otherPlayer.id !== player.id
    && (
      player.avoidRequests.some(name => fuzzyMatcher.isLikelyMatch(name, otherPlayer.name, 0.8))
      || otherPlayer.avoidRequests.some(name => fuzzyMatcher.isLikelyMatch(name, player.name, 0.8))
    )
  )));
}

function validateGroupedMoves(
  suggestion: TeamSuggestionDto,
  playerGroups: AIPlayerGroupInput[],
): string[] {
  const errors: string[] = [];
  const groupByPlayer = new Map<string, AIPlayerGroupInput>();
  playerGroups.forEach(group => {
    group.playerIds.forEach(playerId => groupByPlayer.set(playerId, group));
  });

  suggestion.actions.forEach(action => {
    const group = groupByPlayer.get(action.playerId);
    if (!group) {
      return;
    }

    const matchingGroupActions = suggestion.actions.filter(groupAction => group.playerIds.includes(groupAction.playerId));
    if (matchingGroupActions.length !== group.playerIds.length) {
      errors.push(`Suggestion ${suggestion.id} splits player group ${group.label}.`);
      return;
    }

    const template = matchingGroupActions[0];
    if (!template) {
      return;
    }

    const allParallel = matchingGroupActions.every(groupAction => (
      groupAction.sourceTeamId === template.sourceTeamId
      && groupAction.targetTeamId === template.targetTeamId
    ));

    if (!allParallel) {
      errors.push(`Suggestion ${suggestion.id} moves members of group ${group.label} to different destinations.`);
    }
  });

  return errors;
}

export function parseTeamSuggestionsRequest(input: unknown): TeamSuggestionsRequest {
  return teamSuggestionsRequestSchema.parse(input);
}

export function parseNameMatchRequest(input: unknown): NameMatchRequest {
  return nameMatchRequestSchema.parse(input);
}

export function parseGroupSuggestionsRequest(input: unknown): GroupSuggestionsRequest {
  return groupSuggestionsRequestSchema.parse(input);
}

export function parseTeamDraftRequest(input: unknown): TeamDraftRequest {
  return teamDraftRequestSchema.parse(input);
}

export function validateTeamSuggestions(
  input: TeamSuggestionsRequest,
  suggestions: unknown
): TeamSuggestionDto[] {
  const parsedSuggestions = z.array(teamSuggestionSchema).parse(suggestions);
  const playerIds = new Set(input.players.map(player => player.id));
  const teamIds = new Set(input.teams.map(team => team.id));
  teamIds.add('unassigned');
  const currentTeamByPlayer = buildPlayerTeamMap(input.players, input.teams);
  const validSuggestions: TeamSuggestionDto[] = [];

  parsedSuggestions.forEach(suggestion => {
    const errors: string[] = [];
    const seenPlayers = new Set<string>();

    suggestion.actions.forEach(action => {
      if (!playerIds.has(action.playerId)) {
        errors.push(`Unknown player id ${action.playerId}.`);
      }
      if (!teamIds.has(normalizeTeamId(action.sourceTeamId))) {
        errors.push(`Unknown source team id ${action.sourceTeamId}.`);
      }
      if (!teamIds.has(normalizeTeamId(action.targetTeamId))) {
        errors.push(`Unknown target team id ${action.targetTeamId}.`);
      }
      const currentTeam = currentTeamByPlayer.get(action.playerId) ?? 'unassigned';
      if (currentTeam !== action.sourceTeamId) {
        errors.push(`Player ${action.playerId} is not currently on ${action.sourceTeamId}.`);
      }
      if (seenPlayers.has(action.playerId)) {
        errors.push(`Player ${action.playerId} was moved more than once in the same suggestion.`);
      }
      seenPlayers.add(action.playerId);
    });

    errors.push(...validateGroupedMoves(suggestion, input.playerGroups));

    const simulatedTeams = buildSimulatedTeams(input.players, input.teams, suggestion.actions);
    simulatedTeams.forEach((teamPlayers, teamId) => {
      if (teamId === 'unassigned') {
        return;
      }

      if (teamPlayers.length > input.config.maxTeamSize) {
        errors.push(`Suggestion ${suggestion.id} exceeds the maximum team size on ${teamId}.`);
      }

      if (hasAvoidConflict(teamPlayers)) {
        errors.push(`Suggestion ${suggestion.id} creates an avoid-request conflict on ${teamId}.`);
      }
    });

    if (errors.length === 0) {
      validSuggestions.push(suggestion);
    }
  });

  return validSuggestions;
}

export function validateNameMatches(
  input: NameMatchRequest,
  matches: unknown
): NameMatchDto[] {
  const parsedMatches = z.array(nameMatchSchema).parse(matches);
  const requestedSet = new Set(input.requestedNames);
  const rosterSet = new Set(input.rosterNames);

  return parsedMatches.filter(match => requestedSet.has(match.requested) && (match.matched === null || rosterSet.has(match.matched)));
}

export function validateGroupSuggestions(
  input: GroupSuggestionsRequest,
  suggestions: unknown
): SuggestedGroupDto[] {
  const parsedSuggestions = z.array(groupSuggestionSchema).parse(suggestions);
  const playerMap = new Map(input.players.map(player => [player.id, player]));
  const groupedPlayerIds = new Set(input.existingGroups.flatMap(group => group.playerIds));

  return parsedSuggestions.flatMap(suggestion => {
    const uniquePlayerIds = Array.from(new Set(suggestion.playerIds));
    if (uniquePlayerIds.length !== suggestion.playerIds.length) {
      return [];
    }

    const players = uniquePlayerIds
      .map(playerId => playerMap.get(playerId))
      .filter((player): player is AIPlayerInput => Boolean(player));

    if (players.length !== uniquePlayerIds.length) {
      return [];
    }

    if (players.some(player => groupedPlayerIds.has(player.id))) {
      return [];
    }

    if (hasAvoidConflict(players)) {
      return [];
    }

    const avgSkill = players.length > 0
      ? Number((players.reduce((sum, player) => sum + (player.execSkillRating ?? player.skillRating), 0) / players.length).toFixed(2))
      : 0;

    return [{
      ...suggestion,
      playerIds: uniquePlayerIds,
      playerNames: players.map(player => player.name),
      avgSkill,
    }];
  });
}

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

export function toAILeagueConfigInput(config: AILeagueConfigInput): AILeagueConfigInput {
  return { ...config };
}

export function toAIPlayerGroupInput(group: AIPlayerGroupInput): AIPlayerGroupInput {
  return {
    id: group.id,
    label: group.label,
    playerIds: [...group.playerIds],
  };
}

export function calculateSuggestedGroupAverage(players: Player[]): number {
  if (players.length === 0) {
    return 0;
  }

  return Number((players.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0) / players.length).toFixed(2));
}
