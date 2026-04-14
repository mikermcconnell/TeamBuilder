import type { LeagueConfig } from '@/types';

type EvenTeamConfig = Pick<LeagueConfig, 'restrictToEvenTeams'>;
type TeamCountConfig = Pick<LeagueConfig, 'maxTeamSize' | 'targetTeams' | 'restrictToEvenTeams'>;

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
  config: T
): T & Pick<LeagueConfig, 'restrictToEvenTeams'> {
  const restrictToEvenTeams = isEvenTeamRestrictionEnabled(config);
  const targetTeams = normalizeTeamCount(config.targetTeams, { restrictToEvenTeams });

  return {
    ...config,
    restrictToEvenTeams,
    ...(targetTeams !== undefined ? { targetTeams } : {}),
  } as T & Pick<LeagueConfig, 'restrictToEvenTeams'>;
}
