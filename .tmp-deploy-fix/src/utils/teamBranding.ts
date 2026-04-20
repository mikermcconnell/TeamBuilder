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

export const TEAM_MASCOT_POOL = [
  'Comets',
  'Wolves',
  'Storm',
  'Foxes',
  'Falcons',
  'Waves',
  'Blaze',
  'Rockets',
  'Chargers',
  'Titans',
  'Phoenix',
  'Cyclones',
  'Lynx',
  'Hawks',
  'Owls',
  'Ravens',
  'Thunder',
  'Vipers',
  'Dragons',
  'Voyagers',
  'Guardians',
  'Stingers',
  'Riptide',
  'Summit',
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

function normalizeNameKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getUniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = normalizeNameKey(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

function stripTrailingCopyOrNumber(name: string): string {
  return name
    .trim()
    .replace(/(?:\s+copy(?:\s+\d+)*)+$/i, '')
    .replace(/\s+\d+$/i, '')
    .trim();
}

function buildMascotRotation(primaryMascot: string, offset: number): string[] {
  const fallbackPool = TEAM_MASCOT_POOL.filter(mascot => mascot !== primaryMascot);
  const safeOffset = fallbackPool.length > 0 ? offset % fallbackPool.length : 0;
  const rotatedFallbacks = fallbackPool.length > 0
    ? [...fallbackPool.slice(safeOffset), ...fallbackPool.slice(0, safeOffset)]
    : [];

  return [primaryMascot, ...rotatedFallbacks];
}

function splitTeamNameBaseAndMascot(name: string): { base: string; mascot: string | null } {
  const cleanedName = stripTrailingCopyOrNumber(name);
  const lowerName = cleanedName.toLocaleLowerCase();
  const matchedMascot = TEAM_MASCOT_POOL.find(mascot => lowerName.endsWith(` ${mascot.toLocaleLowerCase()}`));

  if (!matchedMascot) {
    return { base: cleanedName, mascot: null };
  }

  return {
    base: cleanedName.slice(0, cleanedName.length - matchedMascot.length).trim(),
    mascot: matchedMascot,
  };
}

function buildAlternativeTeamNameCandidates(name: string, offset = 0): string[] {
  const { base, mascot } = splitTeamNameBaseAndMascot(name);

  if (!base || !mascot) {
    return [];
  }

  return buildMascotRotation(mascot, offset)
    .map(candidateMascot => `${base} ${candidateMascot}`);
}

export function getUniqueTeamName(baseName: string, usedNames: Set<string>, fallbackCandidates: string[] = []): string {
  const trimmedName = baseName.trim() || 'Team';
  const candidates = getUniqueValues([trimmedName, ...fallbackCandidates]);

  for (const candidate of candidates) {
    if (!usedNames.has(normalizeNameKey(candidate))) {
      usedNames.add(normalizeNameKey(candidate));
      return candidate;
    }
  }

  const fallbackBase = stripTrailingCopyOrNumber(trimmedName) || trimmedName;
  let copyNumber = 2;

  while (true) {
    const candidate = `${fallbackBase} ${copyNumber}`;
    if (!usedNames.has(normalizeNameKey(candidate))) {
      usedNames.add(normalizeNameKey(candidate));
      return candidate;
    }
    copyNumber += 1;
  }
}

export function ensureUniqueTeamNames(
  teams: Team[],
  existingNames: string[] = [],
  options: { preferAlternativeBranding?: boolean } = {}
): Team[] {
  const usedNames = new Set(existingNames.map(normalizeNameKey));

  return teams.map((team, index) => ({
    ...team,
    name: getUniqueTeamName(
      team.name,
      usedNames,
      options.preferAlternativeBranding ? buildAlternativeTeamNameCandidates(team.name, index) : []
    ),
  }));
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
  return buildSuggestedTeamNameCandidates(team, index, playerGroups, config)[0] || `Team ${index + 1}`;
}

function buildSuggestedTeamNameCandidates(team: Team, index: number, playerGroups: PlayerGroup[], config: LeagueConfig): string[] {
  const palette = getTeamBrandPalette(index);
  const groupBase = getDominantGroupLabel(team, playerGroups);
  const mascotOptions = buildMascotRotation(palette.mascot, index);

  if (groupBase) {
    return mascotOptions.map(mascot => `${groupBase} ${mascot}`);
  }

  const leagueBase = deriveLeagueBaseName(config.name);
  if (leagueBase) {
    return mascotOptions.map(mascot => `${leagueBase} ${mascot}`);
  }

  return mascotOptions.map(mascot => `${palette.colorName} ${mascot}`);
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
    const suggestedNameCandidates = buildSuggestedTeamNameCandidates(team, index, playerGroups, config);
    const suggestedName = suggestedNameCandidates[0] || buildSuggestedTeamName(team, index, playerGroups, config);
    const keepManualName = Boolean(team.isNameManuallySet && team.name?.trim());
    const keepManualColor = Boolean(team.isColorManuallySet && team.color);

    let finalName = keepManualName
      ? team.name
      : (options.forceRename || shouldReplaceTeamName(team.name) ? suggestedName : team.name);

    if (!keepManualName && usedNames.has(normalizeNameKey(finalName))) {
      finalName = `${suggestedName} ${index + 1}`;
    }

    finalName = getUniqueTeamName(
      finalName,
      usedNames,
      keepManualName ? [] : suggestedNameCandidates
    );

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
  const colorPalette = TEAM_BRAND_PALETTE[index % TEAM_BRAND_PALETTE.length];
  const mascot = TEAM_MASCOT_POOL[index % TEAM_MASCOT_POOL.length] || colorPalette.mascot;

  return {
    ...colorPalette,
    mascot,
  };
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
