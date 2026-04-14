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

interface OllamaChatResponse {
  model?: string;
  created_at?: string;
  message?: {
    role?: string;
    content?: string;
  };
}

function getGemmaBaseUrl(): string {
  return (process.env.GEMMA_BASE_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/$/, '');
}

function getGemmaModel(): string {
  const model = process.env.GEMMA_MODEL?.trim();

  if (!model) {
    throw new Error('Missing GEMMA_MODEL');
  }

  return model;
}

function buildGemmaSystemPrompt(): string {
  return [
    'You are an intelligent name matcher for a sports league organizer.',
    'Match messy or misspelled requested names to the official roster names.',
    'Consider nicknames, abbreviations, phonetic similarity, and common typos.',
    'Be conservative. If there is no reliable match, return null.',
    'Return valid JSON only.',
    'Use this exact shape:',
    '{"matches":[{"requested":"string","matched":"string|null","confidence":0.0,"reasoning":"string"}]}',
    'Return one result for every requested name.',
  ].join('\n');
}

function parseGemmaMatches(content: string): unknown[] {
  const parsed = JSON.parse(content) as { matches?: unknown[] };

  if (!Array.isArray(parsed.matches)) {
    throw new Error('Gemma response did not include a matches array.');
  }

  return parsed.matches;
}

export class GemmaNameMatchProvider implements AINameMatchProvider {
  readonly name = 'gemma' as const;

  async requestNameMatches(input: NameMatchRequest): Promise<NameMatchProviderResult> {
    const response = await fetch(`${getGemmaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getGemmaModel(),
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
        },
        messages: [
          {
            role: 'system',
            content: buildGemmaSystemPrompt(),
          },
          {
            role: 'user',
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemma request failed with status ${response.status}.`);
    }

    const payload = await response.json() as OllamaChatResponse;
    const content = payload.message?.content?.trim();

    if (!content) {
      throw new Error('Gemma returned an empty response.');
    }

    return {
      matches: parseGemmaMatches(content),
      model: payload.model || getGemmaModel(),
      responseId: payload.created_at,
    };
  }
}

export const gemmaNameMatchProvider = new GemmaNameMatchProvider();

function buildGemmaGroupSuggestionsPrompt(): string {
  return [
    'You suggest small player groups for a recreational sports league.',
    'Look for reciprocal teammate requests first, then strong request chains.',
    'Do not suggest groups that include avoid-request conflicts.',
    'Keep suggested groups practical and between 2 and 4 players.',
    'Only use ungrouped players from the provided data.',
    'Do not invent IDs or names.',
    'Return valid JSON only.',
    'Use this exact shape:',
    '{"suggestions":[{"id":"string","playerIds":["id1","id2"],"playerNames":["Name 1","Name 2"],"reasoning":"string","confidence":"high|medium|low"}]}',
  ].join('\n');
}

function parseGemmaSuggestions(content: string): unknown[] {
  const parsed = JSON.parse(content) as { suggestions?: unknown[] };

  if (!Array.isArray(parsed.suggestions)) {
    throw new Error('Gemma response did not include a suggestions array.');
  }

  return parsed.suggestions;
}

export class GemmaGroupSuggestionsProvider implements AIGroupSuggestionsProvider {
  readonly name = 'gemma' as const;

  async requestGroupSuggestions(input: GroupSuggestionsRequest): Promise<GroupSuggestionsProviderResult> {
    const ungroupedPlayers = input.players.filter(player => !input.existingGroups.some(group => group.playerIds.includes(player.id)));

    const response = await fetch(`${getGemmaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getGemmaModel(),
        stream: false,
        format: 'json',
        options: {
          temperature: 0.2,
        },
        messages: [
          {
            role: 'system',
            content: buildGemmaGroupSuggestionsPrompt(),
          },
          {
            role: 'user',
            content: JSON.stringify({
              existingGroups: input.existingGroups,
              ungroupedPlayers,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemma request failed with status ${response.status}.`);
    }

    const payload = await response.json() as OllamaChatResponse;
    const content = payload.message?.content?.trim();

    if (!content) {
      throw new Error('Gemma returned an empty response.');
    }

    return {
      suggestions: parseGemmaSuggestions(content),
      model: payload.model || getGemmaModel(),
      responseId: payload.created_at,
    };
  }
}

export const gemmaGroupSuggestionsProvider = new GemmaGroupSuggestionsProvider();

function buildGemmaTeamSuggestionsPrompt(userPrompt: string): string {
  return [
    'You are an AI team-building assistant for recreational sports leagues.',
    'Suggest exactly three concrete options to improve the current teams.',
    'Each option must be either a move or a swap.',
    'Respect hard constraints first: avoid conflicts, group integrity, and team size.',
    'Do not invent player IDs or team IDs. Use the IDs exactly as provided.',
    'If a player belongs to a group, move the entire group together.',
    'Use the user request to decide what to optimize, but preserve reasonable skill balance.',
    `User request: ${userPrompt}`,
    'Return valid JSON only.',
    'Use this exact shape:',
    '{"suggestions":[{"id":"string","type":"move|swap","title":"string","reasoning":"string","actions":[{"playerId":"string","sourceTeamId":"string","targetTeamId":"string"}]}]}',
  ].join('\n');
}

function parseGemmaTeamSuggestions(content: string): unknown[] {
  const parsed = JSON.parse(content) as { suggestions?: unknown[] };

  if (!Array.isArray(parsed.suggestions)) {
    throw new Error('Gemma response did not include a suggestions array.');
  }

  return parsed.suggestions;
}

export class GemmaTeamSuggestionsProvider implements AITeamSuggestionsProvider {
  readonly name = 'gemma' as const;

  async requestTeamSuggestions(input: TeamSuggestionsRequest): Promise<TeamSuggestionsProviderResult> {
    const assignedPlayerIds = new Set(input.teams.flatMap(team => team.players.map(player => player.id)));
    const unassignedPlayers = input.players.filter(player => !assignedPlayerIds.has(player.id));
    const playerGroupMap = new Map<string, { groupId: string; groupLabel: string }>();

    input.playerGroups.forEach(group => {
      group.playerIds.forEach(playerId => {
        playerGroupMap.set(playerId, { groupId: group.id, groupLabel: group.label });
      });
    });

    const response = await fetch(`${getGemmaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getGemmaModel(),
        stream: false,
        format: 'json',
        options: {
          temperature: 0.2,
        },
        messages: [
          {
            role: 'system',
            content: buildGemmaTeamSuggestionsPrompt(input.prompt),
          },
          {
            role: 'user',
            content: JSON.stringify({
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
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemma request failed with status ${response.status}.`);
    }

    const payload = await response.json() as OllamaChatResponse;
    const content = payload.message?.content?.trim();

    if (!content) {
      throw new Error('Gemma returned an empty response.');
    }

    return {
      suggestions: parseGemmaTeamSuggestions(content),
      model: payload.model || getGemmaModel(),
      responseId: payload.created_at,
    };
  }
}

export const gemmaTeamSuggestionsProvider = new GemmaTeamSuggestionsProvider();
