import { afterEach, describe, expect, it, vi } from 'vitest';

import { getConfiguredAIProviderName, getGroupSuggestionsProvider, getNameMatchProvider, getTeamSuggestionsProvider } from '@/server/ai/provider';
import { gemmaGroupSuggestionsProvider, gemmaNameMatchProvider, gemmaTeamSuggestionsProvider } from '@/server/ai/providers/gemmaProvider';

const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  GEMMA_BASE_URL: process.env.GEMMA_BASE_URL,
  GEMMA_MODEL: process.env.GEMMA_MODEL,
};

describe('AI provider selection', () => {
  afterEach(() => {
    process.env.AI_PROVIDER = originalEnv.AI_PROVIDER;
    process.env.GEMMA_BASE_URL = originalEnv.GEMMA_BASE_URL;
    process.env.GEMMA_MODEL = originalEnv.GEMMA_MODEL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('defaults to openai when no provider is configured', () => {
    delete process.env.AI_PROVIDER;

    expect(getConfiguredAIProviderName()).toBe('openai');
    expect(getNameMatchProvider().name).toBe('openai');
  });

  it('selects gemma when configured', () => {
    process.env.AI_PROVIDER = 'gemma';

    expect(getConfiguredAIProviderName()).toBe('gemma');
    expect(getNameMatchProvider().name).toBe('gemma');
    expect(getGroupSuggestionsProvider().name).toBe('gemma');
    expect(getTeamSuggestionsProvider().name).toBe('gemma');
  });
});

describe('Gemma name match provider', () => {
  afterEach(() => {
    process.env.AI_PROVIDER = originalEnv.AI_PROVIDER;
    process.env.GEMMA_BASE_URL = originalEnv.GEMMA_BASE_URL;
    process.env.GEMMA_MODEL = originalEnv.GEMMA_MODEL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses a valid Ollama-style JSON response', async () => {
    process.env.GEMMA_BASE_URL = 'http://127.0.0.1:11434';
    process.env.GEMMA_MODEL = 'gemma4-test';

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'gemma4-test',
      created_at: '2026-04-10T21:00:00Z',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          matches: [
            {
              requested: 'Steph V',
              matched: 'Steph Vecchiarelli',
              confidence: 0.93,
              reasoning: 'Nickname plus last initial match.',
            },
          ],
        }),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await gemmaNameMatchProvider.requestNameMatches({
      rosterNames: ['Steph Vecchiarelli', 'Kristy Robinson'],
      requestedNames: ['Steph V'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.model).toBe('gemma4-test');
    expect(result.matches).toEqual([
      {
        requested: 'Steph V',
        matched: 'Steph Vecchiarelli',
        confidence: 0.93,
        reasoning: 'Nickname plus last initial match.',
      },
    ]);
  });

  it('throws a helpful error when GEMMA_MODEL is missing', async () => {
    delete process.env.GEMMA_MODEL;

    await expect(gemmaNameMatchProvider.requestNameMatches({
      rosterNames: ['Steph Vecchiarelli'],
      requestedNames: ['Steph V'],
    })).rejects.toThrow('Missing GEMMA_MODEL');
  });

  it('parses a valid Ollama-style group suggestion response', async () => {
    process.env.GEMMA_BASE_URL = 'http://127.0.0.1:11434';
    process.env.GEMMA_MODEL = 'gemma4-test';

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'gemma4-test',
      created_at: '2026-04-10T21:05:00Z',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          suggestions: [
            {
              id: 'group-1',
              playerIds: ['p1', 'p2'],
              playerNames: ['Kristy Robinson', 'Andy Beecroft'],
              reasoning: 'Mutual request pair with no avoid conflict.',
              confidence: 'high',
            },
          ],
        }),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await gemmaGroupSuggestionsProvider.requestGroupSuggestions({
      players: [
        {
          id: 'p1',
          name: 'Kristy Robinson',
          gender: 'F',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: ['Andy Beecroft'],
          avoidRequests: [],
        },
        {
          id: 'p2',
          name: 'Andy Beecroft',
          gender: 'M',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: ['Kristy Robinson'],
          avoidRequests: [],
        },
      ],
      existingGroups: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.model).toBe('gemma4-test');
    expect(result.suggestions).toEqual([
      {
        id: 'group-1',
        playerIds: ['p1', 'p2'],
        playerNames: ['Kristy Robinson', 'Andy Beecroft'],
        reasoning: 'Mutual request pair with no avoid conflict.',
        confidence: 'high',
      },
    ]);
  });

  it('parses a valid Ollama-style team suggestion response', async () => {
    process.env.GEMMA_BASE_URL = 'http://127.0.0.1:11434';
    process.env.GEMMA_MODEL = 'gemma4-test';

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'gemma4-test',
      created_at: '2026-04-10T21:10:00Z',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          suggestions: [
            {
              id: 'suggestion-1',
              type: 'move',
              title: 'Balance female handling',
              reasoning: 'Moves one female handler to improve balance without breaking team size.',
              actions: [
                {
                  playerId: 'p1',
                  sourceTeamId: 'team-1',
                  targetTeamId: 'team-2',
                },
              ],
            },
          ],
        }),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await gemmaTeamSuggestionsProvider.requestTeamSuggestions({
      prompt: 'Make teams more balanced',
      players: [
        {
          id: 'p1',
          name: 'Kristy Robinson',
          gender: 'F',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: [],
          avoidRequests: [],
          teamId: 'team-1',
        },
        {
          id: 'p2',
          name: 'Andy Beecroft',
          gender: 'M',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: [],
          avoidRequests: [],
          teamId: 'team-2',
        },
      ],
      teams: [
        {
          id: 'team-1',
          name: 'Team 1',
          players: [{ id: 'p1' }],
          averageSkill: 6,
          genderBreakdown: { M: 0, F: 1, Other: 0 },
        },
        {
          id: 'team-2',
          name: 'Team 2',
          players: [{ id: 'p2' }],
          averageSkill: 6,
          genderBreakdown: { M: 1, F: 0, Other: 0 },
        },
      ],
      config: {
        id: 'league-1',
        name: 'League',
        maxTeamSize: 2,
        minFemales: 0,
        minMales: 0,
        allowMixedGender: true,
        targetTeams: 2,
      },
      playerGroups: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.model).toBe('gemma4-test');
    expect(result.suggestions).toEqual([
      {
        id: 'suggestion-1',
        type: 'move',
        title: 'Balance female handling',
        reasoning: 'Moves one female handler to improve balance without breaking team size.',
        actions: [
          {
            playerId: 'p1',
            sourceTeamId: 'team-1',
            targetTeamId: 'team-2',
          },
        ],
      },
    ]);
  });
});
