import { validateAiTeamDraft } from '@/shared/ai-draft';
import type { AITeamDraftPayload, TeamDraftRequest } from '@/shared/ai-contracts';
import { toDomainLeagueConfig, toDomainPlayer, toDomainPlayerGroups } from '@/shared/ai-mappers';
import type { LeagueConfig, Player, PlayerGroup } from '@/types';
import { getEffectiveTeamCount } from '@/utils/teamCount';
import { generateBalancedTeams } from '@/utils/teamGenerator';

import { buildDraftPayload, cloneTeamDraft } from './teamDraftDomain';
import { requestTeamDraft } from './openaiService';
import { repairAiDraftGenderRequirements } from './teamDraftRepair';

function shufflePlayers<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

function clonePlayers(players: Player[]): Player[] {
  return players.map(player => ({
    ...player,
    teammateRequests: [...player.teammateRequests],
    avoidRequests: [...player.avoidRequests],
  }));
}

function cloneGroups(players: Player[], groups: PlayerGroup[]): PlayerGroup[] {
  const playerMap = new Map(players.map(player => [player.id, player]));

  return groups.map(group => ({
    ...group,
    playerIds: [...group.playerIds],
    players: group.playerIds
      .map(playerId => playerMap.get(playerId))
      .filter((player): player is Player => Boolean(player)),
  }));
}

function buildFullCoverageDraft(
  baseDraft: AITeamDraftPayload,
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[],
): AITeamDraftPayload {
  let workingDraft = cloneTeamDraft(baseDraft);
  const unassignedIds = new Set(workingDraft.unassignedPlayerIds ?? []);

  const groupedUnits = playerGroups
    .map(group => group.playerIds.filter(playerId => unassignedIds.has(playerId)))
    .filter(playerIds => playerIds.length > 0);

  const groupedIds = new Set(groupedUnits.flat());
  const individualUnits = [...unassignedIds]
    .filter(playerId => !groupedIds.has(playerId))
    .map(playerId => [playerId]);

  const units = [...groupedUnits, ...individualUnits]
    .sort((left, right) => right.length - left.length);

  for (const unit of units) {
    let nextDraft: AITeamDraftPayload | null = null;

    for (const team of [...workingDraft.teams].sort((left, right) => left.playerIds.length - right.playerIds.length)) {
      if (team.playerIds.length + unit.length > config.maxTeamSize) {
        continue;
      }

      const candidateDraft = cloneTeamDraft(workingDraft);
      const candidateTeam = candidateDraft.teams.find(candidate => candidate.slot === team.slot);
      if (!candidateTeam) {
        continue;
      }

      candidateTeam.playerIds.push(...unit);
      candidateDraft.unassignedPlayerIds = (candidateDraft.unassignedPlayerIds ?? []).filter(playerId => !unit.includes(playerId));

      const validation = validateAiTeamDraft(candidateDraft, players, config, playerGroups);
      if (validation.valid) {
        nextDraft = candidateDraft;
        break;
      }
    }

    if (nextDraft) {
      workingDraft = nextDraft;
    }
  }

  return workingDraft;
}

function buildCandidateDrafts(
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[],
  variant: 'primary' | 'alternate' | undefined
) {
  const expectedTeamCount = getEffectiveTeamCount(players.length, config);
  const basePlayers = clonePlayers(players);
  const balancedGroups = cloneGroups(basePlayers, playerGroups);
  const balancedResult = generateBalancedTeams(
    basePlayers,
    config,
    balancedGroups,
    variant === 'alternate',
    false
  );

  const shuffledPlayers = shufflePlayers(clonePlayers(players));
  const shuffledGroups = cloneGroups(shuffledPlayers, playerGroups);
  const shuffledBalancedResult = generateBalancedTeams(
    shuffledPlayers,
    config,
    shuffledGroups,
    false,
    false
  );

  const randomSeedPlayers = shufflePlayers(clonePlayers(players));
  const randomSeedGroups = cloneGroups(randomSeedPlayers, playerGroups);
  const randomSeedResult = generateBalancedTeams(
    randomSeedPlayers,
    config,
    randomSeedGroups,
    true,
    false
  );

  return [
    {
      id: 'balanced-seed',
      label: 'Balanced seed',
      summary: 'Constraint-aware balanced draft from the built-in team builder.',
      draft: buildDraftPayload(balancedResult.teams, balancedResult.unassignedPlayers, expectedTeamCount),
    },
    {
      id: 'shuffled-seed',
      label: 'Shuffled balanced seed',
      summary: 'Balanced draft generated from a shuffled player order for variety.',
      draft: buildDraftPayload(shuffledBalancedResult.teams, shuffledBalancedResult.unassignedPlayers, expectedTeamCount),
    },
    {
      id: 'random-seed',
      label: 'Random seed',
      summary: 'Randomized starting point that still respects the current constraints when possible.',
      draft: buildDraftPayload(randomSeedResult.teams, randomSeedResult.unassignedPlayers, expectedTeamCount),
    },
    {
      id: 'full-coverage-seed',
      label: 'Full coverage seed',
      summary: 'Valid draft that prioritizes assigning the full roster, even if it introduces avoid-request warnings.',
      draft: buildFullCoverageDraft(
        buildDraftPayload(balancedResult.teams, balancedResult.unassignedPlayers, expectedTeamCount),
        players,
        config,
        playerGroups,
      ),
    },
  ];
}

function buildFallbackResponse(
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[],
  variant: 'primary' | 'alternate' | undefined,
  validationErrors: string[],
  lastAttemptMetadata: Pick<AITeamDraftPayload, 'requestedModel' | 'model' | 'responseId' | 'responseIds'>,
): AITeamDraftPayload {
  const fallbackResult = generateBalancedTeams(
    players.map(player => ({ ...player })),
    config,
    playerGroups.map(group => ({
      ...group,
      playerIds: [...group.playerIds],
      players: group.players.map(player => ({ ...player })),
    })),
    variant === 'alternate',
    false
  );

  return {
    source: 'fallback' as const,
    summary: validationErrors.length > 0
      ? `AI could not produce a valid draft after multiple attempts, so TeamBuilder used the standard builder instead. ${validationErrors.join(' ')}`
      : 'AI could not produce a valid draft after multiple attempts, so TeamBuilder used the standard builder instead.',
    ...lastAttemptMetadata,
    ...buildDraftPayload(
      fallbackResult.teams,
      fallbackResult.unassignedPlayers,
      getEffectiveTeamCount(players.length, config)
    ),
  };
}

export async function generateTeamDraftWithFallback(input: TeamDraftRequest): Promise<AITeamDraftPayload> {
  const players = input.players.map(toDomainPlayer);
  const config = toDomainLeagueConfig(input.config);
  const playerGroups = toDomainPlayerGroups(input.playerGroups, players);
  const candidateDrafts = buildCandidateDrafts(players, config, playerGroups, input.variant);

  let validationErrors: string[] = [];
  let lastAttemptMetadata: Pick<AITeamDraftPayload, 'requestedModel' | 'model' | 'responseId' | 'responseIds'> = {};

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await requestTeamDraft(input, {
      retryAttempt: attempt,
      previousValidationErrors: validationErrors,
      candidateDrafts,
    });
    lastAttemptMetadata = {
      requestedModel: response.requestedModel,
      model: response.model,
      responseId: response.responseId,
      responseIds: response.responseIds,
    };

    const validation = validateAiTeamDraft(response, players, config, playerGroups);
    if (validation.valid) {
      return response;
    }

    const repaired = repairAiDraftGenderRequirements(response, players, config, playerGroups);
    if (repaired.repaired) {
      return {
        ...repaired.draft,
        source: 'ai' as const,
      };
    }

    validationErrors = validation.errors;
  }

  return buildFallbackResponse(
    players,
    config,
    playerGroups,
    input.variant,
    validationErrors,
    lastAttemptMetadata,
  );
}
