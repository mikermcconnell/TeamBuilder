import type { AITeamDraftPayload } from '@/shared/ai-contracts';
import { validateAiTeamDraft } from '@/shared/ai-draft';
import type { LeagueConfig, Player, PlayerGroup } from '@/types';
import { cloneTeamDraft, getDraftBucketIds, getDraftBucketPlayers } from './teamDraftDomain';

export interface TeamDraftCandidate {
  id: string;
  label: string;
  summary: string;
  draft: AITeamDraftPayload;
}

export interface TeamDraftPlanOperation {
  type: 'move' | 'swap';
  sourceId: string;
  targetId: string;
  playerIds: string[];
  swapPlayerIds?: string[];
}

export interface TeamDraftPlanResponse {
  summary: string;
  selectedCandidateId: string;
  operations?: TeamDraftPlanOperation[];
}

function movePlayers(source: string[], target: string[], playerIds: string[]) {
  const nextSource = source.filter(playerId => !playerIds.includes(playerId));
  const nextTarget = [...target.filter(playerId => !playerIds.includes(playerId)), ...playerIds];
  return { nextSource, nextTarget };
}

function applyRawOperation(
  draft: AITeamDraftPayload,
  operation: TeamDraftPlanOperation,
  validPlayerIds: Set<string>,
): AITeamDraftPayload | null {
  const nextDraft = cloneTeamDraft(draft);
  const sourceBucket = getDraftBucketPlayers(nextDraft, operation.sourceId);
  const targetBucket = getDraftBucketPlayers(nextDraft, operation.targetId);

  if (!sourceBucket || !targetBucket || operation.sourceId === operation.targetId) {
    return null;
  }

  if (operation.playerIds.length === 0 || operation.playerIds.some(playerId => !validPlayerIds.has(playerId))) {
    return null;
  }

  const sourceHasPlayers = operation.playerIds.every(playerId => sourceBucket.includes(playerId));
  if (!sourceHasPlayers) {
    return null;
  }

  if (operation.type === 'move') {
    const { nextSource, nextTarget } = movePlayers(sourceBucket, targetBucket, operation.playerIds);
    sourceBucket.splice(0, sourceBucket.length, ...nextSource);
    targetBucket.splice(0, targetBucket.length, ...nextTarget);
    return nextDraft;
  }

  const swapPlayerIds = operation.swapPlayerIds ?? [];
  if (swapPlayerIds.length === 0 || swapPlayerIds.some(playerId => !validPlayerIds.has(playerId))) {
    return null;
  }

  const targetHasPlayers = swapPlayerIds.every(playerId => targetBucket.includes(playerId));
  if (!targetHasPlayers) {
    return null;
  }

  const movedSource = movePlayers(sourceBucket, targetBucket, operation.playerIds);
  sourceBucket.splice(0, sourceBucket.length, ...movedSource.nextSource);
  targetBucket.splice(0, targetBucket.length, ...movedSource.nextTarget);

  const movedTarget = movePlayers(targetBucket, sourceBucket, swapPlayerIds);
  targetBucket.splice(0, targetBucket.length, ...movedTarget.nextSource);
  sourceBucket.splice(0, sourceBucket.length, ...movedTarget.nextTarget);

  return nextDraft;
}

export function applyTeamDraftPlan(options: {
  plan: TeamDraftPlanResponse;
  candidates: TeamDraftCandidate[];
  players: Player[];
  config: LeagueConfig;
  playerGroups: PlayerGroup[];
}): { draft: AITeamDraftPayload; appliedOperations: TeamDraftPlanOperation[]; ignoredOperations: TeamDraftPlanOperation[] } {
  const { plan, candidates, players, config, playerGroups } = options;
  const candidate = candidates.find(item => item.id === plan.selectedCandidateId) ?? candidates[0];

  if (!candidate) {
    throw new Error('No candidate drafts were available for AI team planning.');
  }

  let workingDraft = cloneTeamDraft(candidate.draft);
  const appliedOperations: TeamDraftPlanOperation[] = [];
  const ignoredOperations: TeamDraftPlanOperation[] = [];
  const validPlayerIds = new Set(players.map(player => player.id));
  const validBucketIds = new Set(getDraftBucketIds(workingDraft.teams.length));

  for (const operation of plan.operations ?? []) {
    if (!validBucketIds.has(operation.sourceId) || !validBucketIds.has(operation.targetId)) {
      ignoredOperations.push(operation);
      continue;
    }

    const nextDraft = applyRawOperation(workingDraft, operation, validPlayerIds);
    if (!nextDraft) {
      ignoredOperations.push(operation);
      continue;
    }

    const validation = validateAiTeamDraft(nextDraft, players, config, playerGroups);
    if (!validation.valid) {
      ignoredOperations.push(operation);
      continue;
    }

    workingDraft = nextDraft;
    appliedOperations.push(operation);
  }

  return {
    draft: {
      ...workingDraft,
      source: 'ai',
      summary: plan.summary,
    },
    appliedOperations,
    ignoredOperations,
  };
}
