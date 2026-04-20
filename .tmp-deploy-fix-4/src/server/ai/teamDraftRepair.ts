import type { AITeamDraftPayload } from '../../shared/ai-contracts.js';
import { validateAiTeamDraft } from '../../shared/ai-draft.js';
import type { LeagueConfig, Player, PlayerGroup } from '../../types/index.js';
import { cloneTeamDraft } from './teamDraftDomain.js';

interface DraftUnit {
  id: string;
  playerIds: string[];
}

interface DraftTeamCounts {
  slot: number;
  femaleCount: number;
  maleCount: number;
}

function findTeam(draft: AITeamDraftPayload, slot: number) {
  return draft.teams.find(team => team.slot === slot) ?? null;
}

function getTeamCounts(draft: AITeamDraftPayload, playersById: Map<string, Player>): DraftTeamCounts[] {
  return draft.teams.map(team => {
    let femaleCount = 0;
    let maleCount = 0;

    for (const playerId of team.playerIds) {
      const player = playersById.get(playerId);
      if (player?.gender === 'F') femaleCount += 1;
      if (player?.gender === 'M') maleCount += 1;
    }

    return {
      slot: team.slot,
      femaleCount,
      maleCount,
    };
  });
}

function getShortageScoreForCounts(counts: DraftTeamCounts, config: LeagueConfig) {
  return Math.max(0, config.minFemales - counts.femaleCount) + Math.max(0, config.minMales - counts.maleCount);
}

function getTotalGenderShortageScore(draft: AITeamDraftPayload, playersById: Map<string, Player>, config: LeagueConfig) {
  return getTeamCounts(draft, playersById)
    .reduce((sum, counts) => sum + getShortageScoreForCounts(counts, config), 0);
}

function hasOnlyGenderMinimumErrors(errors: string[]) {
  return errors.every(error => (
    error.includes('does not meet the minimum female requirement')
    || error.includes('does not meet the minimum male requirement')
  ));
}

function buildUnits(draft: AITeamDraftPayload, playerGroups: PlayerGroup[]): DraftUnit[] | null {
  const destinationByPlayer = new Map<string, string>();

  draft.teams.forEach(team => {
    team.playerIds.forEach(playerId => {
      destinationByPlayer.set(playerId, `team-${team.slot}`);
    });
  });

  (draft.unassignedPlayerIds ?? []).forEach(playerId => {
    destinationByPlayer.set(playerId, 'unassigned');
  });

  const groupedPlayerIds = new Set<string>();
  const units: DraftUnit[] = [];

  for (const group of playerGroups) {
    const destinations = new Set(
      group.playerIds
        .map(playerId => destinationByPlayer.get(playerId))
        .filter((destination): destination is string => Boolean(destination))
    );

    if (destinations.size > 1) {
      return null;
    }

    const presentPlayerIds = group.playerIds.filter(playerId => destinationByPlayer.has(playerId));
    if (presentPlayerIds.length > 0) {
      units.push({
        id: `group:${group.id}`,
        playerIds: presentPlayerIds,
      });
      presentPlayerIds.forEach(playerId => groupedPlayerIds.add(playerId));
    }
  }

  draft.teams.forEach(team => {
    team.playerIds.forEach(playerId => {
      if (!groupedPlayerIds.has(playerId)) {
        units.push({
          id: `player:${playerId}`,
          playerIds: [playerId],
        });
      }
    });
  });

  (draft.unassignedPlayerIds ?? []).forEach(playerId => {
    if (!groupedPlayerIds.has(playerId)) {
      units.push({
        id: `player:${playerId}`,
        playerIds: [playerId],
      });
    }
  });

  return units;
}

function findUnitDestination(draft: AITeamDraftPayload, unit: DraftUnit): string | null {
  const unassignedIds = new Set(draft.unassignedPlayerIds ?? []);
  if (unit.playerIds.every(playerId => unassignedIds.has(playerId))) {
    return 'unassigned';
  }

  for (const team of draft.teams) {
    if (unit.playerIds.every(playerId => team.playerIds.includes(playerId))) {
      return `team-${team.slot}`;
    }
  }

  return null;
}

function moveUnit(
  draft: AITeamDraftPayload,
  unit: DraftUnit,
  fromDestination: string,
  toDestination: string,
): AITeamDraftPayload | null {
  const nextDraft = cloneTeamDraft(draft);
  const fromTeam = fromDestination === 'unassigned' ? null : findTeam(nextDraft, Number(fromDestination.replace('team-', '')));
  const toTeam = toDestination === 'unassigned' ? null : findTeam(nextDraft, Number(toDestination.replace('team-', '')));

  const fromBucket = fromDestination === 'unassigned'
    ? (nextDraft.unassignedPlayerIds ?? [])
    : fromTeam?.playerIds;
  const toBucket = toDestination === 'unassigned'
    ? (nextDraft.unassignedPlayerIds ?? [])
    : toTeam?.playerIds;

  if (!fromBucket || !toBucket || fromDestination === toDestination) {
    return null;
  }

  if (!unit.playerIds.every(playerId => fromBucket.includes(playerId))) {
    return null;
  }

  fromBucket.splice(0, fromBucket.length, ...fromBucket.filter(playerId => !unit.playerIds.includes(playerId)));
  toBucket.splice(0, toBucket.length, ...toBucket.filter(playerId => !unit.playerIds.includes(playerId)), ...unit.playerIds);

  return nextDraft;
}

function swapUnits(
  draft: AITeamDraftPayload,
  firstUnit: DraftUnit,
  firstDestination: string,
  secondUnit: DraftUnit,
  secondDestination: string,
): AITeamDraftPayload | null {
  const movedFirst = moveUnit(draft, firstUnit, firstDestination, secondDestination);
  if (!movedFirst) {
    return null;
  }

  return moveUnit(movedFirst, secondUnit, secondDestination, firstDestination);
}

function getUnitGenderCount(unit: DraftUnit, gender: 'F' | 'M', playersById: Map<string, Player>) {
  return unit.playerIds.reduce((sum, playerId) => {
    const player = playersById.get(playerId);
    return sum + (player?.gender === gender ? 1 : 0);
  }, 0);
}

function getValidationErrorsForCandidate(
  draft: AITeamDraftPayload,
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[],
) {
  return validateAiTeamDraft(draft, players, config, playerGroups).errors;
}

export function repairAiDraftGenderRequirements(
  draft: AITeamDraftPayload,
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[],
): { draft: AITeamDraftPayload; repaired: boolean; notes: string[] } {
  const initialValidation = validateAiTeamDraft(draft, players, config, playerGroups);
  if (initialValidation.valid) {
    return {
      draft,
      repaired: false,
      notes: [],
    };
  }

  if (!hasOnlyGenderMinimumErrors(initialValidation.errors)) {
    return {
      draft,
      repaired: false,
      notes: [],
    };
  }

  const units = buildUnits(draft, playerGroups);
  if (!units) {
    return {
      draft,
      repaired: false,
      notes: [],
    };
  }

  const playersById = new Map(players.map(player => [player.id, player]));
  let workingDraft = cloneTeamDraft(draft);
  const notes: string[] = [];

  for (let iteration = 0; iteration < 40; iteration += 1) {
    const currentScore = getTotalGenderShortageScore(workingDraft, playersById, config);
    if (currentScore === 0) {
      break;
    }

    let bestCandidate: {
      draft: AITeamDraftPayload;
      score: number;
      note: string;
    } | null = null;

    const teamCounts = getTeamCounts(workingDraft, playersById);

    for (const target of teamCounts.filter(counts => getShortageScoreForCounts(counts, config) > 0)) {
      const neededGenders: Array<'F' | 'M'> = [];
      if (target.femaleCount < config.minFemales) neededGenders.push('F');
      if (target.maleCount < config.minMales) neededGenders.push('M');

      for (const neededGender of neededGenders) {
        for (const sourceUnit of units) {
          const sourceDestination = findUnitDestination(workingDraft, sourceUnit);
          if (!sourceDestination || sourceDestination === `team-${target.slot}`) {
            continue;
          }

          if (getUnitGenderCount(sourceUnit, neededGender, playersById) === 0) {
            continue;
          }

          const moveCandidate = moveUnit(workingDraft, sourceUnit, sourceDestination, `team-${target.slot}`);
          if (moveCandidate) {
            const errors = getValidationErrorsForCandidate(moveCandidate, players, config, playerGroups);
            if (hasOnlyGenderMinimumErrors(errors)) {
              const score = getTotalGenderShortageScore(moveCandidate, playersById, config);
              if (score < currentScore && (!bestCandidate || score < bestCandidate.score)) {
                bestCandidate = {
                  draft: moveCandidate,
                  score,
                  note: `Moved ${sourceUnit.playerIds.length > 1 ? 'a group' : 'a player'} into team ${target.slot} to improve the ${neededGender === 'F' ? 'female' : 'male'} minimum.`,
                };
              }
            }
          }

          if (sourceDestination === 'unassigned') {
            continue;
          }

          const targetTeam = findTeam(workingDraft, target.slot);
          if (!targetTeam) {
            continue;
          }

          const targetUnits = units.filter(unit => findUnitDestination(workingDraft, unit) === `team-${target.slot}`);
          for (const targetUnit of targetUnits) {
            const swapCandidate = swapUnits(
              workingDraft,
              sourceUnit,
              sourceDestination,
              targetUnit,
              `team-${target.slot}`,
            );

            if (!swapCandidate) {
              continue;
            }

            const errors = getValidationErrorsForCandidate(swapCandidate, players, config, playerGroups);
            if (!hasOnlyGenderMinimumErrors(errors)) {
              continue;
            }

            const score = getTotalGenderShortageScore(swapCandidate, playersById, config);
            if (score < currentScore && (!bestCandidate || score < bestCandidate.score)) {
              bestCandidate = {
                draft: swapCandidate,
                score,
                note: `Swapped players to improve the ${neededGender === 'F' ? 'female' : 'male'} minimum for team ${target.slot}.`,
              };
            }
          }
        }
      }
    }

    if (!bestCandidate) {
      break;
    }

    workingDraft = bestCandidate.draft;
    notes.push(bestCandidate.note);
  }

  const finalValidation = validateAiTeamDraft(workingDraft, players, config, playerGroups);
  if (!finalValidation.valid) {
    return {
      draft,
      repaired: false,
      notes: [],
    };
  }

  return {
    draft: {
      ...workingDraft,
      summary: [draft.summary, 'TeamBuilder repaired the AI draft to satisfy the minimum male and female requirements.']
        .filter(Boolean)
        .join(' '),
    },
    repaired: true,
    notes,
  };
}
