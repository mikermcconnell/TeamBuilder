import { Player, PlayerGroup } from '@/types';
import { fetchGroupSuggestions } from './aiClient';
import {
  toAIPlayerGroupInput,
  toAIPlayerInput,
} from '@/shared/ai-mappers';

export interface SuggestedGroup {
  id: string;
  playerIds: string[];
  playerNames: string[];
  avgSkill: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface GroupSuggestionResult {
  suggestions: SuggestedGroup[];
  error?: string;
}

export async function generateGroupSuggestions(
  players: Player[],
  existingGroups: PlayerGroup[]
): Promise<GroupSuggestionResult> {
  try {
    const suggestions = await fetchGroupSuggestions({
      players: players.map(toAIPlayerInput),
      existingGroups: existingGroups.map(toAIPlayerGroupInput),
    });

    return { suggestions };
  } catch (error) {
    console.error('AI group suggestion error:', error);
    return {
      suggestions: [],
      error: error instanceof Error ? error.message : 'Failed to generate suggestions. Please try again.',
    };
  }
}
