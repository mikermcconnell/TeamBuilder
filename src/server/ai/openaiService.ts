import OpenAI from 'openai';

import { calculateAverageSkillByGender } from '@/shared/ai-draft';
import type {
  GroupSuggestionsRequest,
  NameMatchRequest,
  TeamDraftRequest,
  TeamSuggestionsRequest,
} from '@/shared/ai-contracts';

const AI_MODEL = 'gpt-5.4-mini';

const teamSuggestionsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['move', 'swap'] },
          title: { type: 'string' },
          reasoning: { type: 'string' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                playerId: { type: 'string' },
                sourceTeamId: { type: 'string' },
                targetTeamId: { type: 'string' },
              },
              required: ['playerId', 'sourceTeamId', 'targetTeamId'],
            },
          },
        },
        required: ['id', 'type', 'title', 'reasoning', 'actions'],
      },
    },
  },
  required: ['suggestions'],
} as const;

const nameMatchesSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          requested: { type: 'string' },
          matched: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          confidence: { type: 'number' },
          reasoning: { type: 'string' },
        },
        required: ['requested', 'matched', 'confidence', 'reasoning'],
      },
    },
  },
  required: ['matches'],
} as const;

const groupSuggestionsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          playerIds: {
            type: 'array',
            items: { type: 'string' },
          },
          playerNames: {
            type: 'array',
            items: { type: 'string' },
          },
          reasoning: { type: 'string' },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
        },
        required: ['id', 'playerIds', 'playerNames', 'reasoning', 'confidence'],
      },
    },
  },
  required: ['suggestions'],
} as const;

const teamDraftSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    teams: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          slot: { type: 'number' },
          playerIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['slot', 'playerIds'],
      },
    },
    unassignedPlayerIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['teams'],
} as const;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  return new OpenAI({ apiKey });
}

async function createStructuredResponse<T>(options: {
  schemaName: string;
  schema: object;
  systemPrompt: string;
  userPayload: unknown;
}): Promise<T> {
  const client = getClient();
  const response = await client.responses.create({
    model: AI_MODEL,
    input: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: JSON.stringify(options.userPayload) },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: options.schemaName,
        schema: options.schema,
        strict: true,
      },
    },
  });

  if (!response.output_text) {
    throw new Error('The model returned an empty response.');
  }

  return JSON.parse(response.output_text) as T;
}

export async function requestTeamSuggestions(input: TeamSuggestionsRequest) {
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

  return createStructuredResponse<{ suggestions: unknown[] }>({
    schemaName: 'team_suggestions_response',
    schema: teamSuggestionsSchema,
    systemPrompt,
    userPayload: payload,
  });
}

export async function requestNameMatches(input: NameMatchRequest) {
  const systemPrompt = [
    'You are an intelligent name matcher for a sports league organizer.',
    'Match messy or misspelled requested names to the official roster names.',
    'Consider nicknames, abbreviations, phonetic similarity, and common typos.',
    'Be conservative. If there is no reliable match, return null.',
    'Return one result for every requested name.',
  ].join('\n');

  return createStructuredResponse<{ matches: unknown[] }>({
    schemaName: 'name_match_response',
    schema: nameMatchesSchema,
    systemPrompt,
    userPayload: input,
  });
}

export async function requestGroupSuggestions(input: GroupSuggestionsRequest) {
  const ungroupedPlayers = input.players.filter(player => !input.existingGroups.some(group => group.playerIds.includes(player.id)));

  const systemPrompt = [
    'You suggest small player groups for a recreational sports league.',
    'Look for reciprocal teammate requests first, then strong request chains.',
    'Do not suggest groups that include avoid-request conflicts.',
    'Keep suggested groups practical and between 2 and 4 players.',
    'Only use ungrouped players from the provided data.',
    'Do not invent IDs or names.',
  ].join('\n');

  return createStructuredResponse<{ suggestions: unknown[] }>({
    schemaName: 'group_suggestions_response',
    schema: groupSuggestionsSchema,
    systemPrompt,
    userPayload: {
      existingGroups: input.existingGroups,
      ungroupedPlayers,
    },
  });
}

export async function requestTeamDraft(input: TeamDraftRequest) {
  const teamCount = input.config.targetTeams || Math.ceil(input.players.length / input.config.maxTeamSize);
  const payload = {
    variant: input.variant ?? 'primary',
    teamCount,
    constraints: {
      maxTeamSize: input.config.maxTeamSize,
      minFemales: input.config.minFemales,
      minMales: input.config.minMales,
    },
    targetAverageSkillByGender: calculateAverageSkillByGender(input.players),
    playerGroups: input.playerGroups,
    players: input.players.map(player => ({
      id: player.id,
      name: player.name,
      gender: player.gender,
      skill: player.execSkillRating ?? player.skillRating,
      isHandler: Boolean(player.isHandler),
      teammateRequests: player.teammateRequests,
      avoidRequests: player.avoidRequests,
      groupId: player.groupId ?? null,
    })),
  };

  const systemPrompt = [
    'You are generating a complete sports team draft.',
    `Create exactly ${teamCount} team assignments using the provided player IDs.`,
    'Priorities, in order:',
    '1. Respect avoid requests and keep grouped players together.',
    '2. Meet minimum male and female counts on each team.',
    '3. Honor teammate requests where possible.',
    '4. Keep overall team skill balanced.',
    '5. Keep male and female average skill balanced across teams.',
    '6. Keep handlers balanced.',
    input.variant === 'alternate'
      ? '7. Make this option meaningfully different from the strongest baseline while staying reasonable.'
      : '7. Make this the strongest all-around option.',
    'Use the provided player IDs exactly as given.',
    'Do not invent players or IDs.',
  ].join('\n');

  return createStructuredResponse<{ teams: unknown[]; summary?: string; unassignedPlayerIds?: string[] }>({
    schemaName: 'team_draft_response',
    schema: teamDraftSchema,
    systemPrompt,
    userPayload: payload,
  });
}
