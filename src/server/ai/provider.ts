import type { GroupSuggestionsRequest, NameMatchRequest, TeamSuggestionsRequest } from '@/shared/ai-contracts';

import { gemmaGroupSuggestionsProvider, gemmaNameMatchProvider, gemmaTeamSuggestionsProvider } from './providers/gemmaProvider';
import { openAIGroupSuggestionsProvider, openAINameMatchProvider, openAITeamSuggestionsProvider } from './providers/openaiProvider';

export type AIProviderName = 'openai' | 'gemma';

export interface NameMatchProviderResult {
  matches: unknown[];
  model?: string;
  responseId?: string;
}

export interface GroupSuggestionsProviderResult {
  suggestions: unknown[];
  model?: string;
  responseId?: string;
}

export interface TeamSuggestionsProviderResult {
  suggestions: unknown[];
  model?: string;
  responseId?: string;
}

export interface AINameMatchProvider {
  readonly name: AIProviderName;
  requestNameMatches(input: NameMatchRequest): Promise<NameMatchProviderResult>;
}

export interface AIGroupSuggestionsProvider {
  readonly name: AIProviderName;
  requestGroupSuggestions(input: GroupSuggestionsRequest): Promise<GroupSuggestionsProviderResult>;
}

export interface AITeamSuggestionsProvider {
  readonly name: AIProviderName;
  requestTeamSuggestions(input: TeamSuggestionsRequest): Promise<TeamSuggestionsProviderResult>;
}

export function getConfiguredAIProviderName(): AIProviderName {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === 'gemma'
    ? 'gemma'
    : 'openai';
}

export function getNameMatchProvider(): AINameMatchProvider {
  return getConfiguredAIProviderName() === 'gemma'
    ? gemmaNameMatchProvider
    : openAINameMatchProvider;
}

export function getGroupSuggestionsProvider(): AIGroupSuggestionsProvider {
  return getConfiguredAIProviderName() === 'gemma'
    ? gemmaGroupSuggestionsProvider
    : openAIGroupSuggestionsProvider;
}

export function getTeamSuggestionsProvider(): AITeamSuggestionsProvider {
  return getConfiguredAIProviderName() === 'gemma'
    ? gemmaTeamSuggestionsProvider
    : openAITeamSuggestionsProvider;
}
