export const nameMatchesSchema = {
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

export const groupSuggestionsSchema = {
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

export const teamSuggestionsSchema = {
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
