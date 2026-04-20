import OpenAI from 'openai';

import { calculateAverageSkillByGender } from '@/shared/ai-draft';
import type { GroupSuggestionsRequest, NameMatchRequest, TeamSuggestionsRequest } from '@/shared/ai-contracts';
import type {
  AIGroupSuggestionsProvider,
  AINameMatchProvider,
  AITeamSuggestionsProvider,
  GroupSuggestionsProviderResult,
  NameMatchProviderResult,
  TeamSuggestionsProviderResult,
} from '@/server/ai/provider';
import { groupSuggestionsSchema, nameMatchesSchema, teamSuggestionsSchema } from '@/server/ai/providerSchemas';

const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.4';

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  return new OpenAI({ apiKey });
}

export class OpenAINameMatchProvider implements AINameMatchProvider {
  readonly name = 'openai' as const;

  async requestNameMatches(input: NameMatchRequest): Promise<NameMatchProviderResult> {
    const systemPrompt = [
      'You are an intelligent name matcher for a sports league organizer.',
      'Match messy or misspelled requested names to the official roster names.',
      'Consider nicknames, abbreviations, phonetic similarity, and common typos.',
      'Be conservative. If there is no reliable match, return null.',
      'Return one result for every requested name.',
    ].join('\n');

    const client = getClient();
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(input) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'name_match_response',
          schema: nameMatchesSchema,
          strict: true,
        },
      },
    });

    if (!response.output_text) {
      throw new Error('The model returned an empty response.');
    }

    const parsed = JSON.parse(response.output_text) as { matches?: unknown[] };
    if (!Array.isArray(parsed.matches)) {
      throw new Error('The model response did not include a matches array.');
    }

    return {
      matches: parsed.matches,
      model: response.model,
      responseId: response.id,
    };
  }
}

export const openAINameMatchProvider = new OpenAINameMatchProvider();

export class OpenAIGroupSuggestionsProvider implements AIGroupSuggestionsProvider {
  readonly name = 'openai' as const;

  async requestGroupSuggestions(input: GroupSuggestionsRequest): Promise<GroupSuggestionsProviderResult> {
    const ungroupedPlayers = input.players.filter(player => !input.existingGroups.some(group => group.playerIds.includes(player.id)));

    const systemPrompt = [
      'You suggest small player groups for a recreational sports league.',
      'Look for reciprocal teammate requests first, then strong request chains.',
      'Do not suggest groups that include avoid-request conflicts.',
      'Keep suggested groups practical and between 2 and 4 players.',
      'Only use ungrouped players from the provided data.',
      'Do not invent IDs or names.',
    ].join('\n');

    const client = getClient();
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({
          existingGroups: input.existingGroups,
          ungroupedPlayers,
        }) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'group_suggestions_response',
          schema: groupSuggestionsSchema,
          strict: true,
        },
      },
    });

    if (!response.output_text) {
      throw new Error('The model returned an empty response.');
    }

    const parsed = JSON.parse(response.output_text) as { suggestions?: unknown[] };
    if (!Array.isArray(parsed.suggestions)) {
      throw new Error('The model response did not include a suggestions array.');
    }

    return {
      suggestions: parsed.suggestions,
      model: response.model,
      responseId: response.id,
    };
  }
}

export const openAIGroupSuggestionsProvider = new OpenAIGroupSuggestionsProvider();

export class OpenAITeamSuggestionsProvider implements AITeamSuggestionsProvider {
  readonly name = 'openai' as const;

  async requestTeamSuggestions(input: TeamSuggestionsRequest): Promise<TeamSuggestionsProviderResult> {
    const assignedPlayerIds = new Set(input.teams.flatMap(team => team.players.map(player => player.id)));
    const unassignedPlayers = input.players.filter(player => !assignedPlayerIds.has(player.id));
    const playerGroupMap = new Map<string, { groupId: string; groupLabel: string }>();

    input.playerGroups.forEach(group => {
      group.playerIds.forEach(playerId => {
        playerGroupMap.set(playerId, { groupId: group.id, groupLabel: group.label });
      });
    });

    const payload = {
      request: input.prompt,
      constraints: {
        maxTeamSize: input.config.maxTeamSize,
        gender: { minM: input.config.minMales, minF: input.config.minFemales },
        handlers: 'Try to keep handlers reasonably balanced.',
      },
      targetAverageSkillByGender: calculateAverageSkillByGender(input.players),
      playerGroups: input.playerGroups,
      teams: input.teams.map(team => ({
        id: team.id,
        name: team.name,
        stats: {
          avgSkill: team.averageSkill,
          males: team.genderBreakdown.M,
          females: team.genderBreakdown.F,
          handlers: team.handlerCount ?? 0,
        },
        players: team.players.map(teamPlayer => {
          const player = input.players.find(candidate => candidate.id === teamPlayer.id);
          return {
            id: player?.id,
            name: player?.name,
            skill: player ? (player.execSkillRating ?? player.skillRating) : null,
            gender: player?.gender,
            isHandler: player?.isHandler ?? false,
            groupId: player ? (playerGroupMap.get(player.id)?.groupId ?? null) : null,
            groupLabel: player ? (playerGroupMap.get(player.id)?.groupLabel ?? null) : null,
          };
        }),
      })),
      unassignedPool: unassignedPlayers.map(player => ({
        id: player.id,
        name: player.name,
        skill: player.execSkillRating ?? player.skillRating,
        gender: player.gender,
        isHandler: player.isHandler ?? false,
        groupId: playerGroupMap.get(player.id)?.groupId ?? null,
        groupLabel: playerGroupMap.get(player.id)?.groupLabel ?? null,
      })),
    };

    const systemPrompt = [
      'You are an AI team-building assistant for recreational sports leagues.',
      'Suggest exactly three concrete options to improve the current teams.',
      'Each option must be either a move or a swap.',
      'Respect hard constraints first: avoid conflicts, group integrity, and team size.',
      'Do not invent player IDs or team IDs. Use the IDs exactly as provided.',
      'If a player belongs to a group, move the entire group together.',
      'Use the user request to decide what to optimize, but preserve reasonable skill balance.',
      `User request: ${input.prompt}`,
    ].join('\n');

    const client = getClient();
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'team_suggestions_response',
          schema: teamSuggestionsSchema,
          strict: true,
        },
      },
    });

    if (!response.output_text) {
      throw new Error('The model returned an empty response.');
    }

    const parsed = JSON.parse(response.output_text) as { suggestions?: unknown[] };
    if (!Array.isArray(parsed.suggestions)) {
      throw new Error('The model response did not include a suggestions array.');
    }

    return {
      suggestions: parsed.suggestions,
      model: response.model,
      responseId: response.id,
    };
  }
}

export const openAITeamSuggestionsProvider = new OpenAITeamSuggestionsProvider();
