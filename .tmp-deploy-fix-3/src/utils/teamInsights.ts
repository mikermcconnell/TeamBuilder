import type {
  LeagueConfig,
  LeagueMemoryEntry,
  Player,
  Team,
  TeamGenerationStats,
  TeamIteration,
} from '@/types';
import { getEffectiveSkillRating, getPlayerAge } from '@/types';
import { getPlayerAgeBand } from '@/utils/playerAgeBands';

export interface IterationScoreBreakdown {
  total: number;
  balance: number;
  chemistry: number;
  compliance: number;
  continuity: number;
}

export interface IterationInsights {
  iterationId: string;
  iterationName: string;
  score: IterationScoreBreakdown;
  skillSpread: number;
  sizeSpread: number;
  handlerSpread: number;
  youngSpread: number;
  matureSpread: number;
  eliteStackedTeams: number;
  lowBandStackedTeams: number;
  requestHonourRate: number | null;
  avoidViolations: number;
  unassignedPlayers: number;
  repeatedPairings: number;
  repeatedPairPlayers: number;
  strengths: string[];
  risks: string[];
  summary: string;
}

export interface IterationComparison {
  recommendedIterationId: string | null;
  reasons: string[];
}

export interface ManualMoveRecommendation {
  targetTeamId: string;
  targetTeamName: string;
  nextScore: number;
  scoreDelta: number;
  sizeDelta: number;
  skillDeltaFromLeagueAverage: number;
  helpsGenderBalance: boolean;
  helpsHandlerBalance: boolean;
  reducesRepeatPairings: boolean;
  reasons: string[];
}

function getTeamAverageSkill(team: Team): number {
  if (team.players.length === 0) {
    return 0;
  }

  const total = team.players.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0);
  return total / team.players.length;
}

function rebuildTeam(team: Team): Team {
  const averageSkill = getTeamAverageSkill(team);
  const genderBreakdown = { M: 0, F: 0, Other: 0 };
  let handlerCount = 0;

  team.players.forEach(player => {
    genderBreakdown[player.gender] += 1;
    if (player.isHandler) {
      handlerCount += 1;
    }
  });

  return {
    ...team,
    averageSkill,
    handlerCount,
    genderBreakdown,
  };
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    profile: player.profile ? { ...player.profile } : undefined,
    teammateRequests: [...player.teammateRequests],
    avoidRequests: [...player.avoidRequests],
    teammateRequestsParsed: player.teammateRequestsParsed?.map(request => ({ ...request })),
    unfulfilledRequests: player.unfulfilledRequests?.map(request => ({ ...request })),
  };
}

function cloneTeam(team: Team): Team {
  return rebuildTeam({
    ...team,
    players: team.players.map(clonePlayer),
  });
}

function calculateSpread(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values) - Math.min(...values);
}

function buildHistoricalPairs(leagueMemory: LeagueMemoryEntry[]): Map<string, number> {
  const pairCounts = new Map<string, number>();

  leagueMemory.forEach(entry => {
    entry.teams.forEach(team => {
      const sortedPlayerIds = [...team.playerIds].sort();
      for (let index = 0; index < sortedPlayerIds.length; index += 1) {
        for (let inner = index + 1; inner < sortedPlayerIds.length; inner += 1) {
          const left = sortedPlayerIds[index];
          const right = sortedPlayerIds[inner];
          if (!left || !right) {
            continue;
          }

          const key = `${left}::${right}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    });
  });

  return pairCounts;
}

function countRepeatedPairings(teams: Team[], leagueMemory: LeagueMemoryEntry[]) {
  if (leagueMemory.length === 0) {
    return { repeatedPairings: 0, repeatedPairPlayers: 0 };
  }

  const historicalPairs = buildHistoricalPairs(leagueMemory);
  let repeatedPairings = 0;
  const repeatedPlayers = new Set<string>();

  teams.forEach(team => {
    const sortedPlayers = [...team.players].sort((left, right) => left.id.localeCompare(right.id));
    for (let index = 0; index < sortedPlayers.length; index += 1) {
      for (let inner = index + 1; inner < sortedPlayers.length; inner += 1) {
        const left = sortedPlayers[index];
        const right = sortedPlayers[inner];
        if (!left || !right) {
          continue;
        }

        const key = `${left.id}::${right.id}`;
        if ((historicalPairs.get(key) ?? 0) > 0) {
          repeatedPairings += 1;
          repeatedPlayers.add(left.id);
          repeatedPlayers.add(right.id);
        }
      }
    }
  });

  return {
    repeatedPairings,
    repeatedPairPlayers: repeatedPlayers.size,
  };
}

function countEliteStacks(team: Team): number {
  const eliteFemales = team.players.filter(player => player.gender === 'F' && getEffectiveSkillRating(player) >= 9).length;
  const eliteMales = team.players.filter(player => player.gender === 'M' && getEffectiveSkillRating(player) >= 9).length;
  return Number(eliteFemales > 1) + Number(eliteMales > 1);
}

function countLowBandStacks(team: Team): number {
  const lowBandPlayers = team.players.filter(player => getEffectiveSkillRating(player) <= 3).length;
  return lowBandPlayers > 1 ? 1 : 0;
}

function calculateRequestHonourRate(stats?: TeamGenerationStats): number | null {
  if (!stats) {
    return null;
  }

  const totalRequests =
    stats.mustHaveRequestsHonored +
    stats.mustHaveRequestsBroken +
    stats.niceToHaveRequestsHonored +
    stats.niceToHaveRequestsBroken;

  if (totalRequests === 0) {
    return null;
  }

  const honoured = stats.mustHaveRequestsHonored + stats.niceToHaveRequestsHonored;
  return (honoured / totalRequests) * 100;
}

function calculateCompliancePenalty(teams: Team[], config: LeagueConfig): number {
  return teams.reduce((penalty, team) => {
    let teamPenalty = 0;

    if (team.players.length > config.maxTeamSize) {
      teamPenalty += 4;
    }

    if (team.genderBreakdown.F < config.minFemales) {
      teamPenalty += 4;
    }

    if (team.genderBreakdown.M < config.minMales) {
      teamPenalty += 4;
    }

    return penalty + teamPenalty;
  }, 0);
}

function buildStrengthsAndRisks(
  insights: Omit<IterationInsights, 'strengths' | 'risks' | 'summary'>
): Pick<IterationInsights, 'strengths' | 'risks' | 'summary'> {
  const strengths: string[] = [];
  const risks: string[] = [];

  if (insights.skillSpread <= 0.6) {
    strengths.push('Average skill is tightly balanced across teams.');
  } else if (insights.skillSpread >= 1.5) {
    risks.push('Average skill still swings too much from team to team.');
  }

  if (insights.handlerSpread <= 1) {
    strengths.push('Handlers are distributed evenly.');
  } else {
    risks.push('Handler concentration is uneven.');
  }

  if (insights.eliteStackedTeams === 0) {
    strengths.push('No team is stacking multiple elite 9/10 players of the same gender.');
  } else {
    risks.push(`${insights.eliteStackedTeams} team${insights.eliteStackedTeams === 1 ? '' : 's'} still stack elite players.`);
  }

  if (insights.lowBandStackedTeams === 0) {
    strengths.push('Low-rated players are spread without obvious weak-team clustering.');
  } else {
    risks.push(`${insights.lowBandStackedTeams} team${insights.lowBandStackedTeams === 1 ? '' : 's'} still stack multiple 1-3 rated players.`);
  }

  if (insights.requestHonourRate !== null && insights.requestHonourRate >= 70) {
    strengths.push('Most teammate requests were honoured.');
  } else if (insights.requestHonourRate !== null && insights.requestHonourRate < 50) {
    risks.push('A large share of teammate requests were not honoured.');
  }

  if (insights.avoidViolations === 0) {
    strengths.push('Avoid requests are clean.');
  } else {
    risks.push(`${insights.avoidViolations} avoid conflict${insights.avoidViolations === 1 ? '' : 's'} remain.`);
  }

  if (insights.unassignedPlayers > 0) {
    risks.push(`${insights.unassignedPlayers} player${insights.unassignedPlayers === 1 ? '' : 's'} are still unassigned.`);
  }

  if (insights.repeatedPairings === 0 && insights.repeatedPairPlayers > 0) {
    strengths.push('League memory check shows no repeat teammate pairings.');
  } else if (insights.repeatedPairings > 0) {
    risks.push(`${insights.repeatedPairings} repeat teammate pairing${insights.repeatedPairings === 1 ? '' : 's'} show up from saved league history.`);
  }

  if (insights.youngSpread <= 1 && insights.matureSpread <= 1) {
    strengths.push('Young and mature players are spread evenly.');
  } else if (insights.youngSpread > 1 || insights.matureSpread > 1) {
    risks.push('Age balance is still clustered on at least one team.');
  }

  const summary = strengths.length > 0
    ? strengths[0]
    : risks[0] || 'No major draft signal was detected yet.';

  return { strengths, risks, summary };
}

export function buildIterationInsights(
  iteration: Pick<TeamIteration, 'id' | 'name' | 'teams' | 'unassignedPlayers' | 'stats'>,
  config: LeagueConfig,
  leagueMemory: LeagueMemoryEntry[] = []
): IterationInsights {
  const teams = iteration.teams.map(cloneTeam);
  const unassignedPlayers = iteration.unassignedPlayers ?? [];
  const stats = iteration.stats;
  const requestHonourRate = calculateRequestHonourRate(stats);

  const skillSpread = calculateSpread(teams.map(team => team.averageSkill || getTeamAverageSkill(team)));
  const sizeSpread = calculateSpread(teams.map(team => team.players.length));
  const handlerSpread = calculateSpread(teams.map(team => team.handlerCount ?? team.players.filter(player => player.isHandler).length));
  const youngSpread = calculateSpread(teams.map(team => team.players.filter(player => getPlayerAgeBand(getPlayerAge(player)) === 'young').length));
  const matureSpread = calculateSpread(teams.map(team => team.players.filter(player => getPlayerAgeBand(getPlayerAge(player)) === 'wise').length));
  const eliteStackedTeams = teams.reduce((sum, team) => sum + countEliteStacks(team), 0);
  const lowBandStackedTeams = teams.reduce((sum, team) => sum + countLowBandStacks(team), 0);
  const { repeatedPairings, repeatedPairPlayers } = countRepeatedPairings(teams, leagueMemory);

  const balancePenalty =
    skillSpread * 7 +
    sizeSpread * 3 +
    handlerSpread * 2 +
    youngSpread * 1.5 +
    matureSpread * 1.5 +
    eliteStackedTeams * 4 +
    lowBandStackedTeams * 4;
  const chemistryPenalty =
    (requestHonourRate === null ? 8 : Math.max(0, 20 - requestHonourRate / 5)) +
    (stats?.avoidRequestsViolated ?? 0) * 3 +
    unassignedPlayers.length * 2;
  const compliancePenalty =
    calculateCompliancePenalty(teams, config) +
    eliteStackedTeams * 2 +
    lowBandStackedTeams * 2;
  const continuityPenalty = leagueMemory.length === 0 ? 5 : repeatedPairings * 2.5;

  const score: IterationScoreBreakdown = {
    balance: Math.max(0, Math.round(25 - balancePenalty)),
    chemistry: Math.max(0, Math.round(25 - chemistryPenalty)),
    compliance: Math.max(0, Math.round(25 - compliancePenalty)),
    continuity: Math.max(0, Math.round(25 - continuityPenalty)),
    total: 0,
  };
  score.total = score.balance + score.chemistry + score.compliance + score.continuity;

  const baseInsights = {
    iterationId: iteration.id,
    iterationName: iteration.name,
    score,
    skillSpread,
    sizeSpread,
    handlerSpread,
    youngSpread,
    matureSpread,
    eliteStackedTeams,
    lowBandStackedTeams,
    requestHonourRate,
    avoidViolations: stats?.avoidRequestsViolated ?? 0,
    unassignedPlayers: unassignedPlayers.length,
    repeatedPairings,
    repeatedPairPlayers,
  };

  return {
    ...baseInsights,
    ...buildStrengthsAndRisks(baseInsights),
  };
}

export function compareIterationInsights(
  left: IterationInsights,
  right: IterationInsights
): IterationComparison {
  if (left.iterationId === right.iterationId) {
    return {
      recommendedIterationId: left.iterationId,
      reasons: ['You are comparing the same iteration on both sides.'],
    };
  }

  const leftReasons: string[] = [];
  const rightReasons: string[] = [];

  if (left.score.total > right.score.total) {
    leftReasons.push(`Higher total draft score (${left.score.total} vs ${right.score.total}).`);
  } else if (right.score.total > left.score.total) {
    rightReasons.push(`Higher total draft score (${right.score.total} vs ${left.score.total}).`);
  }

  if (left.skillSpread < right.skillSpread) {
    leftReasons.push('Tighter average skill balance.');
  } else if (right.skillSpread < left.skillSpread) {
    rightReasons.push('Tighter average skill balance.');
  }

  if (left.handlerSpread < right.handlerSpread) {
    leftReasons.push('Better handler distribution.');
  } else if (right.handlerSpread < left.handlerSpread) {
    rightReasons.push('Better handler distribution.');
  }

  if (left.repeatedPairings < right.repeatedPairings) {
    leftReasons.push('Fewer repeat teammate pairings from league memory.');
  } else if (right.repeatedPairings < left.repeatedPairings) {
    rightReasons.push('Fewer repeat teammate pairings from league memory.');
  }

  if ((left.requestHonourRate ?? -1) > (right.requestHonourRate ?? -1)) {
    leftReasons.push('Honours more teammate requests.');
  } else if ((right.requestHonourRate ?? -1) > (left.requestHonourRate ?? -1)) {
    rightReasons.push('Honours more teammate requests.');
  }

  if (leftReasons.length >= rightReasons.length) {
    return {
      recommendedIterationId: left.iterationId,
      reasons: leftReasons.length > 0 ? leftReasons : ['This version edges out the other on current draft signals.'],
    };
  }

  return {
    recommendedIterationId: right.iterationId,
    reasons: rightReasons.length > 0 ? rightReasons : ['This version edges out the other on current draft signals.'],
  };
}

function applyMoveToTeams(teams: Team[], playerId: string, targetTeamId: string): Team[] {
  let movingPlayer: Player | null = null;

  const cleanedTeams = teams.map(team => {
    const remainingPlayers = team.players.filter(player => {
      const shouldKeep = player.id !== playerId;
      if (!shouldKeep) {
        movingPlayer = clonePlayer(player);
      }
      return shouldKeep;
    });

    return rebuildTeam({
      ...team,
      players: remainingPlayers,
    });
  });

  if (!movingPlayer) {
    return teams.map(cloneTeam);
  }

  return cleanedTeams.map(team => (
    team.id === targetTeamId
      ? rebuildTeam({
          ...team,
          players: [...team.players, { ...movingPlayer!, teamId: targetTeamId }],
        })
      : team
  ));
}

export function buildManualMoveRecommendations(
  playerId: string,
  teams: Team[],
  config: LeagueConfig,
  leagueMemory: LeagueMemoryEntry[] = []
): ManualMoveRecommendation[] {
  const sourceTeam = teams.find(team => team.players.some(player => player.id === playerId));
  const player = sourceTeam?.players.find(teamPlayer => teamPlayer.id === playerId);
  if (!player) {
    return [];
  }

  const currentInsights = buildIterationInsights({
    id: 'current',
    name: 'Current',
    teams,
    unassignedPlayers: [],
    stats: undefined,
  }, config, leagueMemory);
  const currentLeagueAverage = teams.length === 0
    ? 0
    : teams.reduce((sum, team) => sum + getTeamAverageSkill(team), 0) / teams.length;

  return teams
    .filter(team => team.id !== sourceTeam?.id)
    .map(targetTeam => {
      const nextTeams = applyMoveToTeams(teams, playerId, targetTeam.id);
      const nextInsights = buildIterationInsights({
        id: targetTeam.id,
        name: targetTeam.name,
        teams: nextTeams,
        unassignedPlayers: [],
        stats: undefined,
      }, config, leagueMemory);
      const rebuiltTarget = nextTeams.find(team => team.id === targetTeam.id) ?? targetTeam;
      const targetAverage = getTeamAverageSkill(rebuiltTarget);
      const reasons: string[] = [];

      const sourceFemaleGap = Math.max(0, config.minFemales - (sourceTeam?.genderBreakdown.F ?? 0));
      const sourceMaleGap = Math.max(0, config.minMales - (sourceTeam?.genderBreakdown.M ?? 0));
      const targetFemaleGap = Math.max(0, config.minFemales - rebuiltTarget.genderBreakdown.F);
      const targetMaleGap = Math.max(0, config.minMales - rebuiltTarget.genderBreakdown.M);
      const helpsGenderBalance =
        (player.gender === 'F' && targetFemaleGap < sourceFemaleGap) ||
        (player.gender === 'M' && targetMaleGap < sourceMaleGap);
      if (helpsGenderBalance) {
        reasons.push('Improves gender minimum coverage.');
      }

      const sourceHandlerGap = Math.abs((sourceTeam?.handlerCount ?? sourceTeam?.players.filter(teamPlayer => teamPlayer.isHandler).length ?? 0) - 3);
      const targetHandlerGap = Math.abs((rebuiltTarget.handlerCount ?? rebuiltTarget.players.filter(teamPlayer => teamPlayer.isHandler).length) - 3);
      const helpsHandlerBalance = Boolean(player.isHandler) && targetHandlerGap < sourceHandlerGap;
      if (helpsHandlerBalance) {
        reasons.push('Moves a handler toward the thinner side.');
      }

      const reducesRepeatPairings = nextInsights.repeatedPairings < currentInsights.repeatedPairings;
      if (reducesRepeatPairings) {
        reasons.push('Breaks up repeat teammate history.');
      }

      if (nextInsights.score.total > currentInsights.score.total) {
        reasons.push('Improves the overall draft score.');
      }

      if (Math.abs(targetAverage - currentLeagueAverage) <= Math.abs((sourceTeam?.averageSkill ?? 0) - currentLeagueAverage)) {
        reasons.push('Keeps average skill closer to league balance.');
      }

      if (rebuiltTarget.players.length > config.maxTeamSize) {
        reasons.push('Would put this team over the size limit.');
      }

      return {
        targetTeamId: targetTeam.id,
        targetTeamName: targetTeam.name,
        nextScore: nextInsights.score.total,
        scoreDelta: nextInsights.score.total - currentInsights.score.total,
        sizeDelta: rebuiltTarget.players.length - targetTeam.players.length,
        skillDeltaFromLeagueAverage: Number((targetAverage - currentLeagueAverage).toFixed(2)),
        helpsGenderBalance,
        helpsHandlerBalance,
        reducesRepeatPairings,
        reasons,
      };
    })
    .sort((left, right) => right.scoreDelta - left.scoreDelta || right.nextScore - left.nextScore)
    .slice(0, 3);
}

export function createLeagueMemoryEntry(
  iteration: Pick<TeamIteration, 'id' | 'name' | 'teams'>,
  title?: string,
  notes?: string
): LeagueMemoryEntry {
  return {
    id: `league-memory-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: title?.trim() || `${iteration.name} Snapshot`,
    createdAt: new Date().toISOString(),
    iterationId: iteration.id,
    iterationName: iteration.name,
    notes: notes?.trim() || undefined,
    teams: iteration.teams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      playerIds: team.players.map(player => player.id),
      playerNames: team.players.map(player => player.name),
    })),
  };
}
