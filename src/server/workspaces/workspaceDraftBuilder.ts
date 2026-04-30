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

const MAX_DIVERSITY_RETRIES_PER_DRAFT = 4;
const MAX_ALLOWED_PAIRING_OVERLAP = 0.85;
const MAX_ALLOWED_GENDER_SPREAD = 1;
const MAX_BUILT_IN_FALLBACK_ATTEMPTS = 24;

function clonePlayer(player: Player): Player {
  return {
    ...player,
    labels: player.labels ? [...player.labels] : undefined,
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

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled;
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

function getPairingKey(playerIdA: string, playerIdB: string): string {
  return [playerIdA, playerIdB].sort().join('::');
}

function buildPairingSet(teams: Team[]): Set<string> {
  const pairings = new Set<string>();

  teams.forEach(team => {
    const teamPlayers = team.players ?? [];
    for (let leftIndex = 0; leftIndex < teamPlayers.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < teamPlayers.length; rightIndex += 1) {
        const leftPlayer = teamPlayers[leftIndex];
        const rightPlayer = teamPlayers[rightIndex];
        if (!leftPlayer || !rightPlayer) {
          continue;
        }

        pairings.add(getPairingKey(leftPlayer.id, rightPlayer.id));
      }
    }
  });

  return pairings;
}

function calculatePairingOverlap(leftTeams: Team[], rightTeams: Team[]): number {
  const leftPairings = buildPairingSet(leftTeams);
  const rightPairings = buildPairingSet(rightTeams);

  if (leftPairings.size === 0 && rightPairings.size === 0) {
    return 1;
  }

  const intersectionCount = [...leftPairings].filter(pairing => rightPairings.has(pairing)).length;
  return intersectionCount / Math.max(leftPairings.size, rightPairings.size, 1);
}

function calculateMaxPairingOverlap(
  candidate: GeneratedWorkspaceDraft,
  existingDrafts: Array<Pick<TeamIteration, 'teams'>>,
): number {
  if (existingDrafts.length === 0) {
    return 0;
  }

  return Math.max(
    ...existingDrafts.map(existingDraft => calculatePairingOverlap(candidate.iteration.teams, existingDraft.teams)),
  );
}

function calculateGenderSpread(teams: Team[]): { maleSpread: number; femaleSpread: number } {
  const maleCounts = teams.map(team => team.genderBreakdown?.M ?? 0);
  const femaleCounts = teams.map(team => team.genderBreakdown?.F ?? 0);

  return {
    maleSpread: Math.max(...maleCounts) - Math.min(...maleCounts),
    femaleSpread: Math.max(...femaleCounts) - Math.min(...femaleCounts),
  };
}

function meetsGenderConsistencyThreshold(candidate: GeneratedWorkspaceDraft): boolean {
  const { maleSpread, femaleSpread } = calculateGenderSpread(candidate.iteration.teams);
  return maleSpread <= MAX_ALLOWED_GENDER_SPREAD && femaleSpread <= MAX_ALLOWED_GENDER_SPREAD;
}

function chooseDiverseDraftCandidate(
  candidates: GeneratedWorkspaceDraft[],
  existingDrafts: Array<Pick<TeamIteration, 'teams'>>,
): GeneratedWorkspaceDraft {
  return [...candidates].sort((left, right) => {
    const leftMeetsGenderThreshold = meetsGenderConsistencyThreshold(left);
    const rightMeetsGenderThreshold = meetsGenderConsistencyThreshold(right);

    if (leftMeetsGenderThreshold !== rightMeetsGenderThreshold) {
      return leftMeetsGenderThreshold ? -1 : 1;
    }

    const leftOverlap = calculateMaxPairingOverlap(left, existingDrafts);
    const rightOverlap = calculateMaxPairingOverlap(right, existingDrafts);
    const leftMeetsThreshold = leftOverlap <= MAX_ALLOWED_PAIRING_OVERLAP;
    const rightMeetsThreshold = rightOverlap <= MAX_ALLOWED_PAIRING_OVERLAP;

    if (leftMeetsThreshold !== rightMeetsThreshold) {
      return leftMeetsThreshold ? -1 : 1;
    }

    if (leftOverlap !== rightOverlap) {
      return leftOverlap - rightOverlap;
    }

    return compareGeneratedDrafts(left, right);
  })[0]!;
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

async function generateDraftCandidate(
  workspace: SavedWorkspace,
  config: LeagueConfig,
  iterationName: string,
  variant: 'primary' | 'alternate',
  createTeamIteration: (input: CreateTeamIterationInput) => Promise<TeamIteration>,
): Promise<GeneratedWorkspaceDraft> {
  const iteration = await createTeamIteration({
    players: workspace.players,
    config,
    playerGroups: workspace.playerGroups,
    name: iterationName,
    variant,
  });

  const insights = buildIterationInsights(
    {
      id: iteration.id,
      name: iteration.name,
      teams: iteration.teams,
      unassignedPlayers: iteration.unassignedPlayers,
      stats: iteration.stats,
    },
    config,
    workspace.leagueMemory ?? [],
  );

  return { iteration, insights };
}

function createBuiltInBalancedCandidate(
  workspace: SavedWorkspace,
  config: LeagueConfig,
  iterationName: string,
  variant: 'primary' | 'alternate',
  referenceDrafts: Array<Pick<TeamIteration, 'teams'>>,
): GeneratedWorkspaceDraft {
  const candidates: GeneratedWorkspaceDraft[] = [];

  for (let attempt = 0; attempt < MAX_BUILT_IN_FALLBACK_ATTEMPTS; attempt += 1) {
    const shouldShuffle = variant === 'alternate' || attempt > 0;
    const candidatePlayers = shouldShuffle
      ? shuffleItems(clonePlayers(workspace.players))
      : clonePlayers(workspace.players);
    const candidateGroups = clonePlayerGroups(candidatePlayers, workspace.playerGroups);
    const generation = generateBalancedTeams(
      candidatePlayers,
      config,
      candidateGroups,
      false,
      false,
    );

    const iteration: TeamIteration = {
      id: createIterationId(),
      name: iterationName,
      type: 'ai',
      status: 'ready',
      generationSource: 'fallback',
      teams: generation.teams.map(cloneTeam),
      unassignedPlayers: generation.unassignedPlayers.map(clonePlayer),
      stats: cloneStats(generation.stats),
      createdAt: new Date().toISOString(),
      errorMessage: 'TeamBuilder used the built-in balanced generator because the AI candidates did not keep male/female team counts consistent enough across teams.',
    };

    const insights = buildIterationInsights(
      {
        id: iteration.id,
        name: iteration.name,
        teams: iteration.teams,
        unassignedPlayers: iteration.unassignedPlayers,
        stats: iteration.stats,
      },
      config,
      workspace.leagueMemory ?? [],
    );

    const candidate = { iteration, insights };
    candidates.push(candidate);

    if (!meetsGenderConsistencyThreshold(candidate)) {
      continue;
    }

    if (referenceDrafts.length === 0 || calculateMaxPairingOverlap(candidate, referenceDrafts) <= MAX_ALLOWED_PAIRING_OVERLAP) {
      break;
    }
  }

  return chooseDiverseDraftCandidate(candidates, referenceDrafts);
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
  const existingReferenceDrafts = existingIterations
    .filter(iteration => iteration.status === 'ready' && iteration.type === 'ai')
    .map(iteration => ({ teams: iteration.teams }));

  for (let index = 0; index < draftCount; index += 1) {
    const desiredName = `AI ${nextAiIterationNumber + index}`;
    const iterationName = getUniqueIterationName(
      desiredName,
      [
        ...existingIterations,
        ...generatedDrafts.map(candidate => candidate.iteration),
      ],
    );
    const candidateDrafts: GeneratedWorkspaceDraft[] = [];
    const referenceDrafts = [
      ...existingReferenceDrafts,
      ...generatedDrafts.map(candidate => ({ teams: candidate.iteration.teams })),
    ];
    const maxAttempts = referenceDrafts.length === 0 ? 1 : (MAX_DIVERSITY_RETRIES_PER_DRAFT + 1);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = await generateDraftCandidate(
        workspace,
        normalizedConfig,
        iterationName,
        getDraftVariant(index + attempt),
        createTeamIteration,
      );

      candidateDrafts.push(candidate);

      if (referenceDrafts.length === 0) {
        break;
      }

      const overlap = calculateMaxPairingOverlap(candidate, referenceDrafts);
      if (overlap <= MAX_ALLOWED_PAIRING_OVERLAP && meetsGenderConsistencyThreshold(candidate)) {
        break;
      }
    }

    const hasAcceptableCandidate = candidateDrafts.some(candidate => (
      meetsGenderConsistencyThreshold(candidate)
      && (referenceDrafts.length === 0 || calculateMaxPairingOverlap(candidate, referenceDrafts) <= MAX_ALLOWED_PAIRING_OVERLAP)
    ));

    if (!hasAcceptableCandidate) {
      candidateDrafts.push(
        createBuiltInBalancedCandidate(
          workspace,
          normalizedConfig,
          iterationName,
          getDraftVariant(index),
          referenceDrafts,
        ),
      );
    }

    generatedDrafts.push(chooseDiverseDraftCandidate(candidateDrafts, referenceDrafts));
  }

  return applyGeneratedDraftsToWorkspace(workspace, generatedDrafts, {
    config: normalizedConfig,
    now: nextUpdatedAt,
  });
}
