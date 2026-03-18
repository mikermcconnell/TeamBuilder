import { LeagueConfig, PlayerGroup, Team, TeamGenerationStats } from '@/types';

interface TeamBrandPalette {
  color: string;
  colorName: string;
  mascot: string;
}

export const TEAM_BRAND_PALETTE: TeamBrandPalette[] = [
  { color: '#2563EB', colorName: 'Blue', mascot: 'Comets' },
  { color: '#059669', colorName: 'Green', mascot: 'Wolves' },
  { color: '#7C3AED', colorName: 'Purple', mascot: 'Storm' },
  { color: '#EA580C', colorName: 'Orange', mascot: 'Foxes' },
  { color: '#DB2777', colorName: 'Rose', mascot: 'Falcons' },
  { color: '#0891B2', colorName: 'Teal', mascot: 'Waves' },
  { color: '#CA8A04', colorName: 'Gold', mascot: 'Blaze' },
  { color: '#4F46E5', colorName: 'Indigo', mascot: 'Rockets' },
];

const GENERIC_LEAGUE_WORDS = new Set([
  'default',
  'league',
  'tournament',
  'clinic',
  'camp',
  'session',
  'preset',
  'config',
  'configuration',
]);

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function deriveLeagueBaseName(configName: string): string {
  const cleaned = configName.trim();
  if (!cleaned || cleaned.toLowerCase() === 'default league') {
    return '';
  }

  const words = cleaned.split(/\s+/).map(word => word.replace(/[^a-z0-9]/gi, ''));
  const meaningful = words.find(word => word && !GENERIC_LEAGUE_WORDS.has(word.toLowerCase()));

  return meaningful ? titleCase(meaningful) : titleCase(words[0] || '');
}

function getDominantGroupLabel(team: Team, playerGroups: PlayerGroup[]): string | null {
  const candidates = playerGroups
    .map(group => ({
      label: group.label,
      count: team.players.filter(player => group.playerIds.includes(player.id)).length,
    }))
    .filter(group => group.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

  return candidates[0]?.label ? `Group ${candidates[0].label}` : null;
}

function buildSuggestedTeamName(team: Team, index: number, playerGroups: PlayerGroup[], config: LeagueConfig): string {
  const palette = getTeamBrandPalette(index);
  const groupBase = getDominantGroupLabel(team, playerGroups);

  if (groupBase) {
    return `${groupBase} ${palette.mascot}`;
  }

  const leagueBase = deriveLeagueBaseName(config.name);
  if (leagueBase) {
    return `${leagueBase} ${palette.mascot}`;
  }

  return `${palette.colorName} ${palette.mascot}`;
}

function shouldReplaceTeamName(name: string): boolean {
  if (!name.trim()) return true;
  return /^team\s+\d+$/i.test(name.trim());
}

export function applyTeamBranding(
  teams: Team[],
  playerGroups: PlayerGroup[] = [],
  config: LeagueConfig,
  options: { forceRename?: boolean; forceColor?: boolean } = {}
): Team[] {
  const usedNames = new Set<string>();

  return teams.map((team, index) => {
    const palette = getTeamBrandPalette(index);
    const suggestedName = buildSuggestedTeamName(team, index, playerGroups, config);
    const keepManualName = Boolean(team.isNameManuallySet && team.name?.trim());
    const keepManualColor = Boolean(team.isColorManuallySet && team.color);

    let finalName = keepManualName
      ? team.name
      : (options.forceRename || shouldReplaceTeamName(team.name) ? suggestedName : team.name);

    if (!keepManualName && usedNames.has(finalName)) {
      finalName = `${suggestedName} ${index + 1}`;
    }

    usedNames.add(finalName);

    return {
      ...team,
      name: finalName,
      color: keepManualColor ? team.color : (options.forceColor || !team.color ? palette.color : team.color),
      colorName: keepManualColor
        ? team.colorName || getColorName(team.color)
        : (options.forceColor || !team.colorName ? palette.colorName : team.colorName),
    };
  });
}

export function getTeamBrandPalette(index: number): TeamBrandPalette {
  return TEAM_BRAND_PALETTE[index % TEAM_BRAND_PALETTE.length];
}

export function getColorName(color: string | undefined): string {
  if (!color) {
    return 'Slate';
  }

  const paletteMatch = TEAM_BRAND_PALETTE.find(entry => entry.color.toLowerCase() === color.toLowerCase());
  return paletteMatch?.colorName || 'Custom';
}

export function hexToRgba(hex: string | undefined, alpha: number): string {
  if (!hex) return `rgba(148, 163, 184, ${alpha})`;

  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  const int = Number.parseInt(safeHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function generateShareableSummary(
  teams: Team[],
  config: LeagueConfig,
  stats?: TeamGenerationStats,
  unassignedCount = 0
): string {
  const lines: string[] = [];

  lines.push(`TeamBuilder Summary — ${config.name}`);
  lines.push(`Generated ${new Date().toLocaleString()}`);
  lines.push('');

  teams.forEach(team => {
    const colorLabel = team.colorName ? `${team.colorName} • ` : '';
    lines.push(`${colorLabel}${team.name}`);
    lines.push(`Players: ${team.players.length} • Avg Skill: ${team.averageSkill.toFixed(1)} • ${team.genderBreakdown.F}F / ${team.genderBreakdown.M}M / ${team.genderBreakdown.Other}O`);
    lines.push(team.players.map(player => player.name).join(', '));
    lines.push('');
  });

  if (stats) {
    lines.push(`Requests honored: ${stats.mutualRequestsHonored}`);
    lines.push(`Avoid violations: ${stats.avoidRequestsViolated}`);
    lines.push(`Unassigned players: ${unassignedCount}`);
  }

  return lines.join('\n').trim();
}
