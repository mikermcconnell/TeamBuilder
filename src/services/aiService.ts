import { Player, Team, LeagueConfig, PlayerGroup, TeamGenerationStats } from '@/types';
import { TeamSuggestion } from '@/types/ai';
import { buildGenerationResult, generateBalancedTeams } from '@/utils/teamGenerator';
import { buildTeamsFromDraft, parseAiTeamDraftResponse, validateAiTeamDraft } from '@/shared/ai-draft';
import type {
  AITeamDraftPayload,
  NameMatchDto,
} from '@/shared/ai-contracts';
import { fetchNameMatches, fetchTeamDraft, fetchTeamSuggestions } from './aiClient';
import {
  toAILeagueConfigInput,
  toAIPlayerGroupInput,
  toAIPlayerInput,
  toAITeamInput,
} from '@/shared/ai-mappers';

export type { AITeamDraftPayload };

export interface AIFullTeamResult {
  teams: Team[];
  unassignedPlayers: Player[];
  stats: TeamGenerationStats;
  source: 'ai' | 'fallback';
  summary?: string;
  aiModel?: string;
  aiResponseId?: string;
  aiResponseIds?: string[];
}

export type AIMatchResult = NameMatchDto;

function joinReasons(reasons: string[]): string {
  return reasons
    .map(reason => reason.trim())
    .filter(Boolean)
    .join(' ');
}

function formatAiFailureSummary(prefix: string, details?: string[]): string {
  const suffix = details && details.length > 0 ? ` ${joinReasons(details)}` : '';
  return `${prefix}${suffix}`.trim();
}

export async function generateFullAiTeams(
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[] = [],
  variant: 'primary' | 'alternate' = 'primary'
): Promise<AIFullTeamResult> {
  const fallbackResult = generateBalancedTeams(players, config, playerGroups, variant === 'alternate', false);

  try {
    const payload = await fetchTeamDraft({
      players: players.map(toAIPlayerInput),
      config: toAILeagueConfigInput(config),
      playerGroups: playerGroups.map(toAIPlayerGroupInput),
      variant,
    });

    const validation = validateAiTeamDraft(payload, players, config, playerGroups);
    if (!validation.valid) {
      console.warn('AI full-team draft failed validation, using fallback:', validation.errors);
      return {
        ...fallbackResult,
        source: 'fallback',
        aiModel: payload.model,
        aiResponseId: payload.responseId,
        aiResponseIds: payload.responseIds,
        summary: formatAiFailureSummary(
          'The AI draft broke TeamBuilder’s rules, so the built-in balancer was used instead.',
          validation.errors,
        ),
      };
    }

    const built = buildTeamsFromDraft(payload, players, fallbackResult.teams);
    const finalResult = buildGenerationResult(
      players,
      built.teams,
      built.unassignedPlayers,
      config,
      playerGroups
    );

    if (validation.warnings?.length) {
      console.warn('AI full-team draft warnings:', validation.warnings);
    }

    return {
      ...finalResult,
      source: payload.source === 'fallback' ? 'fallback' : 'ai',
      aiModel: payload.model,
      aiResponseId: payload.responseId,
      aiResponseIds: payload.responseIds,
      summary: validation.warnings?.length
        ? [payload.summary, ...validation.warnings].filter(Boolean).join(' ')
        : payload.summary,
    };
  } catch (error) {
    console.error('Full AI team generation failed, using fallback:', error);
    const message = error instanceof Error ? error.message.trim() : 'Unknown AI request error.';
    return {
      ...fallbackResult,
      source: 'fallback',
      summary: `The AI request failed before a valid draft was returned, so TeamBuilder used its built-in balancer instead. ${message}`.trim(),
    };
  }
}

export async function generateTeamSuggestions(
  prompt: string,
  players: Player[],
  teams: Team[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[] = []
): Promise<TeamSuggestion[]> {
  try {
    return await fetchTeamSuggestions({
      prompt,
      players: players.map(toAIPlayerInput),
      teams: teams.map(toAITeamInput),
      config: toAILeagueConfigInput(config),
      playerGroups: playerGroups.map(toAIPlayerGroupInput),
    });
  } catch (error) {
    console.error('AI team suggestion error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate suggestions');
  }
}

export async function findPlayerMatches(
  unmatchedNames: string[],
  rosterNames: string[]
): Promise<AIMatchResult[]> {
  const uniqueRequests = Array.from(new Set(unmatchedNames));

  if (uniqueRequests.length === 0 || rosterNames.length === 0) {
    return [];
  }

  try {
    return await fetchNameMatches({
      rosterNames,
      requestedNames: uniqueRequests,
    });
  } catch (error) {
    console.error('AI matching error:', error);
    return [];
  }
}

export { parseAiTeamDraftResponse, validateAiTeamDraft };
