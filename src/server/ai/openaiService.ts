import OpenAI from 'openai';

import { calculateAverageSkillByGender } from '@/shared/ai-draft';
import { getEffectiveTeamCount } from '@/utils/teamCount';
import type {
  AITeamDraftPayload,
  GroupSuggestionsRequest,
  NameMatchRequest,
  TeamDraftRequest,
  TeamSuggestionsRequest,
} from '@/shared/ai-contracts';
import { toDomainLeagueConfig, toDomainPlayer, toDomainPlayerGroups } from '@/shared/ai-mappers';
import type { LeagueConfig, Player, PlayerGroup } from '@/types';
import { applyTeamDraftPlan, type TeamDraftCandidate, type TeamDraftPlanResponse } from './teamDraftPlanner';
import { buildDraftSnapshot, cloneTeamDraft, getDraftBucketIds } from './teamDraftDomain';
import { getGroupSuggestionsProvider, getNameMatchProvider, getTeamSuggestionsProvider } from './provider';

const AI_MODEL = 'gpt-5.4';

interface StructuredResponseResult<T> {
  data: T;
  model: string;
  responseId: string;
}

const MAX_IMPROVEMENT_ROUNDS = 2;

function joinSummaryParts(parts: Array<string | undefined | null>) {
  return parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

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
}): Promise<StructuredResponseResult<T>> {
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

  return {
    data: JSON.parse(response.output_text) as T,
    model: response.model,
    responseId: response.id,
  };
}

export async function requestTeamSuggestions(input: TeamSuggestionsRequest) {
  return getTeamSuggestionsProvider().requestTeamSuggestions(input);
}

export async function requestNameMatches(input: NameMatchRequest) {
  return getNameMatchProvider().requestNameMatches(input);
}

export async function requestGroupSuggestions(input: GroupSuggestionsRequest) {
  return getGroupSuggestionsProvider().requestGroupSuggestions(input);
}

export async function requestTeamDraft(
  input: TeamDraftRequest,
  options?: {
    retryAttempt?: number;
    previousValidationErrors?: string[];
    candidateDrafts?: TeamDraftCandidate[];
  }
) {
  const teamCount = getEffectiveTeamCount(input.players.length, input.config);
  const domainPlayers = input.players.map(toDomainPlayer);
  const domainConfig = toDomainLeagueConfig(input.config);
  const domainPlayerGroups = toDomainPlayerGroups(input.playerGroups, domainPlayers);
  const candidateDrafts = options?.candidateDrafts ?? [];
  const candidateIds = candidateDrafts.map(candidate => candidate.id);
  const candidatePayload = {
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
    retryAttempt: options?.retryAttempt ?? 1,
    previousValidationErrors: options?.previousValidationErrors ?? [],
    candidateDrafts: candidateDrafts.map(candidate => ({
      id: candidate.id,
      label: candidate.label,
      summary: candidate.summary,
      unassignedCount: candidate.draft.unassignedPlayerIds?.length ?? 0,
      draft: buildDraftSnapshot(candidate.draft, input.players),
    })),
  };

  const candidateSelectionSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      selectedCandidateId: {
        type: 'string',
        enum: candidateIds.length > 0 ? candidateIds : ['balanced-seed'],
      },
    },
    required: ['summary', 'selectedCandidateId'],
  } as const;

  const selectionPrompt = [
    'You are selecting the strongest starting point for a sports team draft.',
    `Choose the single best candidate draft for exactly ${teamCount} teams.`,
    'Do not redesign the whole draft from scratch.',
    'Pick the best valid starting point first; refinements happen later in smaller steps.',
    'Priorities, in order:',
    '1. Account for every player exactly once and prefer zero unassigned players whenever possible.',
    '2. Keep grouped players together.',
    '3. Meet minimum male and female counts on each team.',
    input.config.allowMixedGender
      ? '3a. Mixed-gender teams are allowed when needed.'
      : '3a. Mixed-gender teams are not allowed. Each team must contain players of only one gender.',
    '4. Honor teammate requests where possible.',
    '5. Keep overall team skill balanced.',
    '6. Keep male and female average skill balanced across teams.',
    '7. Keep handlers balanced.',
    input.variant === 'alternate'
      ? '8. Make this option meaningfully different from the strongest baseline while staying reasonable.'
      : '8. Make this the strongest all-around option.',
    '9. Avoid-request conflicts should be minimized, but full player coverage is more important than perfectly honoring every avoid request.',
    '10. Only leave players unassigned if the provided candidates show that full assignment is not realistically possible.',
    'Do not invent candidate IDs.',
    'Return strict JSON that follows the schema exactly.',
    options?.previousValidationErrors?.length
      ? `Previous attempt failed for these reasons:\n- ${options.previousValidationErrors.join('\n- ')}\nFix those issues in this new draft.`
      : '',
  ].join('\n');

  const { data: selection, model, responseId } = await createStructuredResponse<{ summary: string; selectedCandidateId: string }>({
    schemaName: 'team_draft_candidate_selection',
    schema: candidateSelectionSchema,
    systemPrompt: selectionPrompt,
    userPayload: candidatePayload,
  });

  console.info(`[AI team draft] Requested model: ${AI_MODEL}; actual model: ${model}; response ID: ${responseId}`);
  const responseIds = [responseId];

  const selectedCandidate = candidateDrafts.find(candidate => candidate.id === selection.selectedCandidateId) ?? candidateDrafts[0];
  if (!selectedCandidate) {
    throw new Error('No candidate drafts were available for AI team planning.');
  }

  let workingDraft = cloneTeamDraft(selectedCandidate.draft);
  workingDraft.source = 'ai';
  workingDraft.summary = joinSummaryParts([
    selection.summary,
    `Started from ${selectedCandidate.label}.`,
  ]);

  for (let round = 1; round <= MAX_IMPROVEMENT_ROUNDS; round += 1) {
    const playerIds = input.players.map(player => player.id);
    const bucketIds = getDraftBucketIds(teamCount);
    const operationSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['move', 'swap'] },
        sourceId: { type: 'string', enum: bucketIds },
        targetId: { type: 'string', enum: bucketIds },
        playerIds: {
          type: 'array',
          items: { type: 'string', enum: playerIds },
          minItems: 1,
        },
        swapPlayerIds: {
          type: 'array',
          items: { type: 'string', enum: playerIds },
        },
      },
      required: ['type', 'sourceId', 'targetId', 'playerIds', 'swapPlayerIds'],
    } as const;

    const improvementSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        operations: {
          type: 'array',
          maxItems: 1,
          items: operationSchema,
        },
      },
      required: ['summary', 'operations'],
    } as const;

    const improvementPrompt = [
      'You are improving an existing sports team draft one small step at a time.',
      `This is refinement round ${round} of ${MAX_IMPROVEMENT_ROUNDS}.`,
      'Do not try to solve everything at once.',
      'Return at most one safe move or swap operation.',
      'If no safe improvement exists, return an empty operations array.',
      'Hard rules come first:',
      '1. Every player must stay accounted for exactly once.',
      '2. Keep grouped players together.',
      '3. Meet minimum male and female counts on each team.',
      input.config.allowMixedGender
        ? '3a. Mixed-gender teams are allowed when needed.'
        : '3a. Mixed-gender teams are not allowed.',
      '4. Respect team size limits.',
      'Only after the hard rules are safe should you improve skill balance, teammate requests, avoid requests, and handler balance.',
      'Use only the provided bucket IDs and player IDs exactly as given.',
      'If you are unsure, do nothing.',
      'For move operations, return an empty swapPlayerIds array.',
      'Return strict JSON that follows the schema exactly.',
    ].join('\n');

    const { data: improvement, responseId: improvementResponseId } = await createStructuredResponse<{
      summary: string;
      operations: TeamDraftPlanResponse['operations'];
    }>({
      schemaName: `team_draft_improvement_round_${round}`,
      schema: improvementSchema,
      systemPrompt: improvementPrompt,
      userPayload: {
        variant: input.variant ?? 'primary',
        round,
        maxRounds: MAX_IMPROVEMENT_ROUNDS,
        constraints: candidatePayload.constraints,
        targetAverageSkillByGender: candidatePayload.targetAverageSkillByGender,
        playerGroups: candidatePayload.playerGroups,
        players: candidatePayload.players,
        currentDraft: buildDraftSnapshot(workingDraft, input.players),
      },
    });

    responseIds.push(improvementResponseId);

    if (!improvement.operations || improvement.operations.length === 0) {
      workingDraft.summary = joinSummaryParts([workingDraft.summary, improvement.summary]);
      break;
    }

    const planResult = applyTeamDraftPlan({
      plan: {
        summary: improvement.summary,
        selectedCandidateId: 'working-draft',
        operations: improvement.operations,
      },
      candidates: [{
        id: 'working-draft',
        label: 'Working draft',
        summary: workingDraft.summary ?? '',
        draft: workingDraft,
      }],
      players: domainPlayers,
      config: domainConfig,
      playerGroups: domainPlayerGroups,
    });

    if (planResult.appliedOperations.length === 0) {
      workingDraft.summary = joinSummaryParts([
        workingDraft.summary,
        improvement.summary,
        'Stopped after the AI could not find a safe one-step improvement.',
      ]);
      break;
    }

    workingDraft = {
      ...planResult.draft,
      source: 'ai',
      summary: joinSummaryParts([workingDraft.summary, improvement.summary]),
    };
  }

  return {
    ...workingDraft,
    requestedModel: AI_MODEL,
    model,
    responseId: responseIds[responseIds.length - 1],
    responseIds,
  };
}
