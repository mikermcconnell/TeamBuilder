import type { LeagueConfig } from '../types/index.js';

type EvenTeamConfig = Pick<LeagueConfig, 'restrictToEvenTeams'>;
type TeamCountConfig = Pick<LeagueConfig, 'maxTeamSize' | 'targetTeams' | 'restrictToEvenTeams'>;
interface NormalizeLeagueConfigOptions {
  mode?: 'preserve-odd' | 'enforce-even';
}

export function isEvenTeamRestrictionEnabled(config?: EvenTeamConfig | null): boolean {
  return config?.restrictToEvenTeams !== false;
}

export function normalizeTeamCount(
  teamCount: number | undefined,
  config?: EvenTeamConfig | null
): number | undefined {
  if (teamCount === undefined || teamCount <= 0 || !isEvenTeamRestrictionEnabled(config)) {
    return teamCount;
  }

  return teamCount % 2 === 0 ? teamCount : teamCount + 1;
}

export function getEffectiveTeamCount(playerCount: number, config: TeamCountConfig): number {
  if (playerCount <= 0) {
    return normalizeTeamCount(config.targetTeams ?? 0, config) ?? 0;
  }

  const baseTeamCount = config.targetTeams ?? Math.ceil(playerCount / config.maxTeamSize);
  return normalizeTeamCount(baseTeamCount, config) ?? 0;
}

export function normalizeLeagueConfig<T extends Partial<LeagueConfig>>(
  config: T,
  options: NormalizeLeagueConfigOptions = {}
): T & Pick<LeagueConfig, 'restrictToEvenTeams'> {
  const mode = options.mode ?? 'preserve-odd';
  const requestedRestriction = isEvenTeamRestrictionEnabled(config);
  const requestedTargetTeams = config.targetTeams;
  const hasOddExplicitTarget = requestedTargetTeams !== undefined
    && requestedTargetTeams > 0
    && requestedTargetTeams % 2 !== 0;

  if (requestedRestriction && hasOddExplicitTarget) {
    if (mode === 'enforce-even') {
      return {
        ...config,
        restrictToEvenTeams: true,
        targetTeams: normalizeTeamCount(requestedTargetTeams, { restrictToEvenTeams: true }),
      } as T & Pick<LeagueConfig, 'restrictToEvenTeams'>;
    }

    return {
      ...config,
      restrictToEvenTeams: false,
      targetTeams: requestedTargetTeams,
    } as T & Pick<LeagueConfig, 'restrictToEvenTeams'>;
  }

  const restrictToEvenTeams = requestedRestriction;
  const targetTeams = normalizeTeamCount(requestedTargetTeams, { restrictToEvenTeams });
  const normalizedMaxAutoGroupSize = typeof config.maxAutoGroupSize === 'number'
    ? Math.max(
      2,
      Math.min(
        Math.floor(config.maxAutoGroupSize),
        typeof config.maxTeamSize === 'number' ? config.maxTeamSize : Math.floor(config.maxAutoGroupSize),
      ),
    )
    : undefined;

  return {
    ...config,
    restrictToEvenTeams,
    ...(normalizedMaxAutoGroupSize !== undefined ? { maxAutoGroupSize: normalizedMaxAutoGroupSize } : {}),
    ...(targetTeams !== undefined ? { targetTeams } : {}),
  } as T & Pick<LeagueConfig, 'restrictToEvenTeams'>;
}
