import { buildTeamsFromDraft } from '../../shared/ai-draft.js';
import { toAILeagueConfigInput, toAIPlayerGroupInput, toAIPlayerInput } from '../../shared/ai-mappers.js';
import type {
  LeagueConfig,
  Player,
  PlayerGroup,
  SavedWorkspace,
  Team,
  TeamGenerationStats,
  TeamIteration,
} from '../../types/index.js';
import { compareIterationInsights, type IterationInsights, buildIterationInsights } from '../../utils/teamInsights.js';
import { buildGenerationResult, generateBalancedTeams } from '../../utils/teamGenerator.js';
import { normalizeLeagueConfig } from '../../utils/teamCount.js';

import { generateTeamDraftWithFallback } from '../ai/teamDraftOrchestrator.js';

export interface WorkspaceDraftBuilderOptions {
  draftCount?: number;
  targetTeams?: number;
  now?: string;
}

export interface GeneratedWorkspaceDraft {
  iteration: TeamIteration;
  insights: IterationInsights;
}

export interface WorkspaceDraftBuildResult {
  workspace: SavedWorkspace;
  generatedDrafts: GeneratedWorkspaceDraft[];
  activeDraft: GeneratedWorkspaceDraft;
}

interface CreateTeamIterationInput {
  config: LeagueConfig;
  name: string;
  playerGroups: PlayerGroup[];
  players: Player[];
  variant: 'primary' | 'alternate';
}

interface WorkspaceDraftBuilderDependencies {
  createTeamIteration?: (input: CreateTeamIterationInput) => Promise<TeamIteration>;
}

interface ApplyGeneratedDraftOptions {
  config?: LeagueConfig;
  now?: string;
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    profile: player.profile ? { ...player.profile } : undefined,
    teammateRequests: [...(player.teammateRequests ?? [])],
    avoidRequests: [...(player.avoidRequests ?? [])],
    teammateRequestsParsed: player.teammateRequestsParsed?.map(request => ({ ...request })),
    unfulfilledRequests: player.unfulfilledRequests?.map(request => ({ ...request })),
  };
}

function cloneTeam(team: Team): Team {
  return {
    ...team,
    players: (team.players ?? []).map(clonePlayer),
    genderBreakdown: {
      M: team.genderBreakdown?.M ?? 0,
      F: team.genderBreakdown?.F ?? 0,
      Other: team.genderBreakdown?.Other ?? 0,
    },
  };
}

function cloneStats(stats?: TeamGenerationStats): TeamGenerationStats | undefined {
  return stats ? { ...stats } : undefined;
}

function clonePlayers(players: Player[]): Player[] {
  return players.map(clonePlayer);
}

function clonePlayerGroups(players: Player[], groups: PlayerGroup[]): PlayerGroup[] {
  const playerMap = new Map(players.map(player => [player.id, player]));

  return groups.map(group => ({
    ...group,
    playerIds: [...group.playerIds],
    players: group.playerIds
      .map(playerId => playerMap.get(playerId))
      .filter((player): player is Player => Boolean(player)),
  }));
}

function createIterationId(): string {
  return `ai-iteration-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function getUniqueIterationName(desiredName: string, existingIterations: TeamIteration[]): string {
  const usedNames = new Set(existingIterations.map(iteration => normalizeNameKey(iteration.name)));
  const trimmedName = desiredName.trim() || 'Untitled Draft';

  if (!usedNames.has(normalizeNameKey(trimmedName))) {
    return trimmedName;
  }

  let copyNumber = 2;
  let candidate = `${trimmedName} ${copyNumber}`;

  while (usedNames.has(normalizeNameKey(candidate))) {
    copyNumber += 1;
    candidate = `${trimmedName} ${copyNumber}`;
  }

  return candidate;
}

function isLikelyManualIteration(
  teams: Team[] | undefined,
  unassignedPlayers: Player[] | undefined,
  players: Player[],
): boolean {
  const safeTeams = teams ?? [];

  if (safeTeams.length === 0) {
    return false;
  }

  return safeTeams.every(team => (team.players?.length ?? 0) === 0)
    && (unassignedPlayers?.length ?? 0) >= players.length;
}

function normalizeExistingIterations(workspace: SavedWorkspace): TeamIteration[] {
  const iterations = (workspace.teamIterations ?? []).map(iteration => ({
    ...iteration,
    teams: (iteration.teams ?? []).map(cloneTeam),
    unassignedPlayers: (iteration.unassignedPlayers ?? []).map(clonePlayer),
    stats: cloneStats(iteration.stats),
  }));

  if (iterations.length > 0) {
    return iterations;
  }

  const hasLegacyTeamState = (workspace.teams?.length ?? 0) > 0
    || (workspace.unassignedPlayers?.length ?? 0) > 0
    || Boolean(workspace.stats);
  if (!hasLegacyTeamState) {
    return [];
  }

  const type = isLikelyManualIteration(workspace.teams, workspace.unassignedPlayers, workspace.players)
    ? 'manual'
    : 'generated';

  return [{
    id: `${type}-iteration-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: type === 'manual' ? 'Manual 1' : 'Generated 1',
    type,
    status: 'ready',
    generationSource: type === 'manual' ? 'manual' : 'generated',
    teams: (workspace.teams ?? []).map(cloneTeam),
    unassignedPlayers: (workspace.unassignedPlayers ?? []).map(clonePlayer),
    stats: cloneStats(workspace.stats),
    createdAt: workspace.updatedAt || workspace.createdAt || new Date().toISOString(),
  }];
}

function getNextAiIterationNumber(existingIterations: TeamIteration[]): number {
  const aiNumbers = existingIterations
    .map(iteration => /^ai\s+(\d+)$/i.exec(iteration.name)?.[1])
    .map(match => Number.parseInt(match ?? '', 10))
    .filter(number => Number.isFinite(number));

  return aiNumbers.length > 0 ? Math.max(...aiNumbers) + 1 : 1;
}

function getDraftVariant(index: number): 'primary' | 'alternate' {
  return index % 2 === 0 ? 'primary' : 'alternate';
}

function assignPlayersToTeams(players: Player[], teams: Team[]): Player[] {
  const teamIdByPlayerId = new Map<string, string>();

  teams.forEach(team => {
    team.players.forEach(player => {
      teamIdByPlayerId.set(player.id, team.id);
    });
  });

  return players.map(player => ({
    ...clonePlayer(player),
    teamId: teamIdByPlayerId.get(player.id),
  }));
}

function compareGeneratedDrafts(left: GeneratedWorkspaceDraft, right: GeneratedWorkspaceDraft): number {
  const totalScoreDelta = right.insights.score.total - left.insights.score.total;
  if (totalScoreDelta !== 0) {
    return totalScoreDelta;
  }

  const unassignedDelta = left.iteration.unassignedPlayers.length - right.iteration.unassignedPlayers.length;
  if (unassignedDelta !== 0) {
    return unassignedDelta;
  }

  const skillSpreadDelta = left.insights.skillSpread - right.insights.skillSpread;
  if (skillSpreadDelta !== 0) {
    return skillSpreadDelta;
  }

  const handlerSpreadDelta = left.insights.handlerSpread - right.insights.handlerSpread;
  if (handlerSpreadDelta !== 0) {
    return handlerSpreadDelta;
  }

  const repeatedPairingsDelta = left.insights.repeatedPairings - right.insights.repeatedPairings;
  if (repeatedPairingsDelta !== 0) {
    return repeatedPairingsDelta;
  }

  const requestHonourRateDelta = (right.insights.requestHonourRate ?? -1) - (left.insights.requestHonourRate ?? -1);
  if (requestHonourRateDelta !== 0) {
    return requestHonourRateDelta;
  }

  const comparison = compareIterationInsights(left.insights, right.insights);
  if (comparison.recommendedIterationId === right.iteration.id) {
    return 1;
  }

  if (comparison.recommendedIterationId === left.iteration.id) {
    return -1;
  }

  return 0;
}

function chooseActiveDraft(candidates: GeneratedWorkspaceDraft[]): GeneratedWorkspaceDraft {
  return [...candidates].sort(compareGeneratedDrafts)[0]!;
}

function renameGeneratedDrafts(
  existingIterations: TeamIteration[],
  generatedDrafts: GeneratedWorkspaceDraft[],
): GeneratedWorkspaceDraft[] {
  const renamedDrafts: GeneratedWorkspaceDraft[] = [];

  generatedDrafts.forEach(candidate => {
    const nextName = getUniqueIterationName(
      candidate.iteration.name,
      [
        ...existingIterations,
        ...renamedDrafts.map(draft => draft.iteration),
      ],
    );

    renamedDrafts.push({
      iteration: {
        ...candidate.iteration,
        name: nextName,
      },
      insights: {
        ...candidate.insights,
        iterationName: nextName,
      },
    });
  });

  return renamedDrafts;
}

export function applyGeneratedDraftsToWorkspace(
  workspace: SavedWorkspace,
  generatedDrafts: GeneratedWorkspaceDraft[],
  options: ApplyGeneratedDraftOptions = {},
): WorkspaceDraftBuildResult {
  const nextUpdatedAt = options.now ?? new Date().toISOString();
  const normalizedConfig = options.config ?? normalizeLeagueConfig(workspace.config);
  const existingIterations = normalizeExistingIterations({
    ...workspace,
    config: normalizedConfig,
  });
  const renamedDrafts = renameGeneratedDrafts(existingIterations, generatedDrafts);
  const activeDraft = chooseActiveDraft(renamedDrafts);
  const syncedPlayers = assignPlayersToTeams(workspace.players, activeDraft.iteration.teams);
  const syncedPlayerGroups = clonePlayerGroups(syncedPlayers, workspace.playerGroups);

  return {
    workspace: {
      ...workspace,
      players: syncedPlayers,
      playerGroups: syncedPlayerGroups,
      config: normalizedConfig,
      teams: activeDraft.iteration.teams.map(cloneTeam),
      unassignedPlayers: activeDraft.iteration.unassignedPlayers.map(clonePlayer),
      stats: cloneStats(activeDraft.iteration.stats),
      teamIterations: [
        ...existingIterations.map(iteration => ({
          ...iteration,
          teams: iteration.teams.map(cloneTeam),
          unassignedPlayers: iteration.unassignedPlayers.map(clonePlayer),
          stats: cloneStats(iteration.stats),
        })),
        ...renamedDrafts.map(candidate => ({
          ...candidate.iteration,
          teams: candidate.iteration.teams.map(cloneTeam),
          unassignedPlayers: candidate.iteration.unassignedPlayers.map(clonePlayer),
          stats: cloneStats(candidate.iteration.stats),
        })),
      ],
      activeTeamIterationId: activeDraft.iteration.id,
      updatedAt: nextUpdatedAt,
      revision: workspace.revision + 1,
    },
    generatedDrafts: renamedDrafts,
    activeDraft,
  };
}

async function createAiTeamIteration({
  players,
  config,
  playerGroups,
  name,
  variant,
}: CreateTeamIterationInput): Promise<TeamIteration> {
  const clonedPlayers = clonePlayers(players);
  const clonedGroups = clonePlayerGroups(clonedPlayers, playerGroups);
  const fallbackSeed = generateBalancedTeams(
    clonePlayers(clonedPlayers),
    config,
    clonePlayerGroups(clonedPlayers, clonedGroups),
    variant === 'alternate',
    false,
  );

  const payload = await generateTeamDraftWithFallback({
    players: clonedPlayers.map(toAIPlayerInput),
    config: toAILeagueConfigInput(config),
    playerGroups: clonedGroups.map(toAIPlayerGroupInput),
    variant,
  });

  const built = buildTeamsFromDraft(payload, clonedPlayers, fallbackSeed.teams);
  const finalized = buildGenerationResult(
    clonedPlayers,
    built.teams,
    built.unassignedPlayers,
    config,
    clonedGroups,
  );

  return {
    id: createIterationId(),
    name,
    type: 'ai',
    status: 'ready',
    generationSource: payload.source === 'fallback' ? 'fallback' : 'ai',
    aiModel: payload.model,
    aiResponseId: payload.responseId,
    aiResponseIds: payload.responseIds,
    teams: finalized.teams.map(cloneTeam),
    unassignedPlayers: finalized.unassignedPlayers.map(clonePlayer),
    stats: cloneStats(finalized.stats),
    createdAt: new Date().toISOString(),
    errorMessage: payload.summary,
  };
}

export async function buildWorkspaceWithGeneratedDrafts(
  workspace: SavedWorkspace,
  options: WorkspaceDraftBuilderOptions = {},
  dependencies: WorkspaceDraftBuilderDependencies = {},
): Promise<WorkspaceDraftBuildResult> {
  const draftCount = Math.max(1, Math.floor(options.draftCount ?? 1));
  const nextUpdatedAt = options.now ?? new Date().toISOString();
  const normalizedConfig = normalizeLeagueConfig({
    ...workspace.config,
    ...(options.targetTeams ? { targetTeams: options.targetTeams } : {}),
  });
  const existingIterations = normalizeExistingIterations({
    ...workspace,
    config: normalizedConfig,
  });
  const createTeamIteration = dependencies.createTeamIteration ?? createAiTeamIteration;
  const nextAiIterationNumber = getNextAiIterationNumber(existingIterations);
  const generatedDrafts: GeneratedWorkspaceDraft[] = [];

  for (let index = 0; index < draftCount; index += 1) {
    const desiredName = `AI ${nextAiIterationNumber + index}`;
    const iterationName = getUniqueIterationName(
      desiredName,
      [
        ...existingIterations,
        ...generatedDrafts.map(candidate => candidate.iteration),
      ],
    );
    const iteration = await createTeamIteration({
      players: workspace.players,
      config: normalizedConfig,
      playerGroups: workspace.playerGroups,
      name: iterationName,
      variant: getDraftVariant(index),
    });

    const insights = buildIterationInsights(
      {
        id: iteration.id,
        name: iteration.name,
        teams: iteration.teams,
        unassignedPlayers: iteration.unassignedPlayers,
        stats: iteration.stats,
      },
      normalizedConfig,
      workspace.leagueMemory ?? [],
    );

    generatedDrafts.push({ iteration, insights });
  }

  return applyGeneratedDraftsToWorkspace(workspace, generatedDrafts, {
    config: normalizedConfig,
    now: nextUpdatedAt,
  });
}
