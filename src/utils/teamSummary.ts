import type { Gender, Team } from '@/types';
import { getEffectiveSkillRating } from '@/types';

export interface TeamSkillSpreadMetric {
  spread: number | null;
  lowestAverage: number | null;
  highestAverage: number | null;
  contributingTeamCount: number;
}

export interface TeamSkillSpreadSummary {
  overall: TeamSkillSpreadMetric;
  male: TeamSkillSpreadMetric;
  female: TeamSkillSpreadMetric;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildMetric(values: number[]): TeamSkillSpreadMetric {
  if (values.length === 0) {
    return {
      spread: null,
      lowestAverage: null,
      highestAverage: null,
      contributingTeamCount: 0,
    };
  }

  const lowestAverage = Math.min(...values);
  const highestAverage = Math.max(...values);

  return {
    spread: roundToTenth(highestAverage - lowestAverage),
    lowestAverage: roundToTenth(lowestAverage),
    highestAverage: roundToTenth(highestAverage),
    contributingTeamCount: values.length,
  };
}

function getTeamAverageSkill(team: Team): number | null {
  if (team.players.length === 0) {
    return null;
  }

  const totalSkill = team.players.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0);
  return totalSkill / team.players.length;
}

function getTeamAverageSkillByGender(team: Team, gender: Gender): number | null {
  const matchingPlayers = team.players.filter(player => player.gender === gender);
  if (matchingPlayers.length === 0) {
    return null;
  }

  const totalSkill = matchingPlayers.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0);
  return totalSkill / matchingPlayers.length;
}

function compactNumbers(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null);
}

export function buildTeamSkillSpreadSummary(teams: Team[]): TeamSkillSpreadSummary {
  return {
    overall: buildMetric(compactNumbers(teams.map(getTeamAverageSkill))),
    male: buildMetric(compactNumbers(teams.map(team => getTeamAverageSkillByGender(team, 'M')))),
    female: buildMetric(compactNumbers(teams.map(team => getTeamAverageSkillByGender(team, 'F')))),
  };
}
