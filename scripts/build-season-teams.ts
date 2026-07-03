import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import Papa from 'papaparse';
import XLSX from 'xlsx';

const YOUNG_PLAYER_MAX_AGE = 21;
const WISE_PLAYER_MIN_AGE = 44;
const NICE_TO_PLAY_TARGET_RATE = 0.75;
const REQUIRED_METADATA_COLUMNS = [
  ['Must Play Group', 'Player Requests'],
  ['Nice To Play', 'Would like to play with'],
  ['Female Leader', 'Labels'],
  ['Male Leader Tier', 'Labels', 'Captain'],
  ['Handler', 'Is Handler', 'Handling'],
  ['New/Returning'],
];

type Gender = 'M' | 'F' | 'Other';

export interface WorkbookRow {
  [key: string]: unknown;
}

export interface DraftPlayer {
  name: string;
  gender: Gender;
  age?: number;
  skillRating: number;
  execSkillRating: number | null;
  playerRequests: string[];
  niceToPlayRequests: string[];
  avoidRequests: string[];
  mustPlayGroup?: string;
  labels: string[];
  isHandler: boolean;
  isNewPlayer?: boolean;
  requestMatches: RequestNameMatch[];
  sourceRow: WorkbookRow;
}

export interface DraftTeam {
  id: string;
  name: string;
  players: DraftPlayer[];
}

export interface HardGroup {
  id: string;
  playerNames: string[];
  source: 'explicit' | 'mutual-request' | 'mixed';
}

export type RequestSourceColumn = 'Player Requests' | 'Would like to play with' | 'Do_Not_Play';
export type RequestMatchStatus = 'exact' | 'nickname' | 'partial' | 'fuzzy' | 'ambiguous' | 'unmatched';

export interface RequestNameMatch {
  playerName: string;
  sourceColumn: RequestSourceColumn;
  inputName: string;
  status: RequestMatchStatus;
  matchedName?: string;
  score?: number;
  candidates?: string[];
}

export interface NiceToPlayMapping {
  playerName: string;
  requestedName: string;
  sourceColumn: 'Mutual nice-to-play';
}

export interface IgnoredNiceToPlayMapping {
  playerName: string;
  requestedName: string;
  sourceColumn: 'Player Requests' | 'Would like to play with';
}

export interface RequestMappingAudit {
  hardGroups: HardGroup[];
  requestMatches: RequestNameMatch[];
  autoMatchedRequests: RequestNameMatch[];
  reviewNeededRequests: RequestNameMatch[];
  niceToPlayMappings: NiceToPlayMapping[];
  ignoredOneWayNiceRequests: IgnoredNiceToPlayMapping[];
}

export interface DraftMetrics {
  playerCount: number;
  teamCount: number;
  teamSizeSpread: number;
  maleSpread: number;
  femaleSpread: number;
  genderSpreadViolations: number;
  skillSpread: number;
  handlerSpread: number;
  femaleLeaderTeams: number;
  maleLeaderCoveredTeams: number;
  niceToPlayHonored: number;
  niceToPlayBroken: number;
  niceToPlayTotal: number;
  niceToPlayHonorRate: number;
  niceToPlayTargetMet: boolean;
  newPlayerSpread: number;
  youngPlayerSpread: number;
  wisePlayerSpread: number;
  avoidViolations: number;
  hardGroupViolations: number;
}

export interface SeasonDraftResult {
  seasonName: string;
  variationName?: string;
  teams: DraftTeam[];
  players: DraftPlayer[];
  hardGroups: HardGroup[];
  metrics: DraftMetrics;
  hardRulesPassed: boolean;
}

interface DraftUnit {
  id: string;
  players: DraftPlayer[];
}

interface TeamTargets {
  size: number;
  male: number;
  female: number;
  other: number;
}

interface TargetedDraftTeam extends DraftTeam {
  targets?: TeamTargets;
}

interface BuildOptions {
  rows: WorkbookRow[];
  teamCount: number;
  seasonName: string;
  maxTeamSize?: number;
  draftSeed?: number;
  variationName?: string;
}

interface CliOptions {
  workbook?: string;
  sheet?: string;
  teamCount?: string;
  season?: string;
  outDir?: string;
  maxTeamSize?: string;
  variationCount?: string;
  draftSeeds?: string;
}

export function parseRequestedNames(value: unknown): string[] {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return [];
  }

  const normalized = raw.toLowerCase();
  if (['no', 'none', 'n/a', 'na', 'nil'].includes(normalized)) {
    return [];
  }

  const withoutPrefix = normalized.startsWith('yes:')
    ? raw.slice(raw.indexOf(':') + 1)
    : raw;

  return unique(
    withoutPrefix
      .replace(/\((?!\s*\d+\s*\))[^)]*\)/g, ' ')
      .replace(/\(\s*\d+\s*\)/g, ';')
      .replace(/\b\d+\s*[.)]\s*/g, ';')
      .replace(/\s+(?:and|&)\s+/gi, ';')
      .split(/[,;\n]+/)
      .map(value => value.trim())
      .filter(Boolean),
  );
}

export function parseRosterRows(rows: WorkbookRow[]): DraftPlayer[] {
  const seen = new Set<string>();

  const players = rows
    .map((row, index) => {
      const name = getString(row, ['Full Name', 'Name', 'Player Name'])
        || `${getString(row, ['first_name', 'first name'])} ${getString(row, ['last_name', 'last name'])}`.trim();

      if (!name) {
        throw new Error(`Roster row ${index + 2} is missing a player name.`);
      }

      const nameKey = normalizeName(name);
      if (seen.has(nameKey)) {
        throw new Error(`Duplicate player name found: "${name}".`);
      }
      seen.add(nameKey);

      const skillRating = getDraftSkillRating(row);
      if (!Number.isFinite(skillRating)) {
        throw new Error(`Player "${name}" is missing a numeric skill rating.`);
      }

      const execSkillRating = getOptionalNumber(row, ['Exec Skill Rating', 'Exec']);
      const gender = normalizeGender(getString(row, ['gender', 'Gender']));
      const age = getOptionalInteger(row, ['age', 'Age']);
      const femaleLeader = parseBoolean(getString(row, ['Female Leader']));
      const maleLeaderTier = getString(row, ['Male Leader Tier']).trim().toUpperCase();
      const labels = new Set<string>();

      if (femaleLeader && gender === 'F') {
        labels.add('leader-a-female');
      }

      if (gender === 'M') {
        if (['A', 'LEADER A', 'A MALE', 'LEADER A MALE'].includes(maleLeaderTier)) {
          labels.add('leader-a-male');
        }
        if (['B', 'LEADER B', 'B MALE', 'LEADER B MALE'].includes(maleLeaderTier)) {
          labels.add('leader-b-male');
        }
      }

      const captainPreference = getString(row, ['Captain']);
      if (isCaptainLeaderB(captainPreference)) {
        labels.add(getLeaderBLabel(gender));
      }

      parseLabels(getString(row, ['Labels', 'labels'])).forEach(label => labels.add(label));
      const normalizedLabels = normalizeLeaderLabels(Array.from(labels), gender);
      const explicitHandlerValue = getString(row, ['Handler', 'Is Handler']);

      return {
        name,
        gender,
        age,
        skillRating,
        execSkillRating,
        playerRequests: parseRequestedNames(getString(row, ['Player Requests', 'Player_Request_#1:', 'Teammate Requests'])),
        niceToPlayRequests: unique([
          ...parseRequestedNames(getString(row, ['Would like to play with', 'Nice To Play', 'Nice-to-play'])),
        ]),
        avoidRequests: parseRequestedNames(getString(row, ['Do_Not_Play', 'Do Not Play', 'Avoid Requests'])),
        mustPlayGroup: getString(row, ['Must Play Group', 'Must-Play Group']).trim() || undefined,
        labels: normalizedLabels,
        isHandler: explicitHandlerValue
          ? parseBoolean(explicitHandlerValue)
          : parseHandlingAsHandler(getString(row, ['Handling'])),
        isNewPlayer: parseNewPlayer(getString(row, ['New/Returning', 'New Player', 'Is New Player', 'New'])),
        requestMatches: [],
        sourceRow: row,
      };
    });

  resolveRequestsForPlayers(players);
  return players;
}

export function validateWorkbookRowsForDrafting(rows: WorkbookRow[]): void {
  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error('Workbook has no roster rows.');
  }

  const headers = new Set(Object.keys(firstRow).map(header => header.trim().toLowerCase()));
  const missingColumns = REQUIRED_METADATA_COLUMNS
    .filter(alternatives => !alternatives.some(column => headers.has(column.toLowerCase())))
    .map(alternatives => alternatives.join(' or '));

  if (missingColumns.length > 0) {
    throw new Error(`Missing required metadata columns: ${missingColumns.join(', ')}.`);
  }
}

export function buildRequestMappingAuditFromRows(rows: WorkbookRow[]): RequestMappingAudit {
  const players = parseRosterRows(rows);
  const hardGroups = buildHardGroups(players);
  applyMutualNiceToPlayRules(players, hardGroups);
  return buildRequestMappingAudit(players, hardGroups);
}

export function buildRequestMappingAudit(players: DraftPlayer[], hardGroups: HardGroup[]): RequestMappingAudit {
  const requestMatches = players.flatMap(player => player.requestMatches);
  const niceToPlayMappings: NiceToPlayMapping[] = [];
  const ignoredOneWayNiceRequests: IgnoredNiceToPlayMapping[] = [];
  const hardPairKeys = new Set(hardGroups.flatMap(group => buildPairKeys(group.playerNames)));
  const seenNicePairs = new Set<string>();
  const seenIgnored = new Set<string>();

  for (const match of requestMatches) {
    if (!match.matchedName || match.sourceColumn === 'Do_Not_Play') {
      continue;
    }

    const pairKey = buildPairKey(match.playerName, match.matchedName);
    if (hardPairKeys.has(pairKey)) {
      continue;
    }

    const player = findPlayer(players, match.playerName);
    const requestedPlayer = findPlayer(players, match.matchedName);
    const isMutualNice = Boolean(
      player
      && requestedPlayer
      && player.niceToPlayRequests.some(name => namesMatch(name, requestedPlayer.name))
      && requestedPlayer.niceToPlayRequests.some(name => namesMatch(name, player.name))
    );

    if (isMutualNice && !seenNicePairs.has(pairKey)) {
      seenNicePairs.add(pairKey);
      niceToPlayMappings.push({
        playerName: match.playerName,
        requestedName: match.matchedName,
        sourceColumn: 'Mutual nice-to-play',
      });
      continue;
    }

    const ignoredKey = `${normalizeName(match.playerName)}|${normalizeName(match.matchedName)}|${match.sourceColumn}`;
    if (!isMutualNice && !seenIgnored.has(ignoredKey) && match.sourceColumn !== 'Player Requests') {
      seenIgnored.add(ignoredKey);
      ignoredOneWayNiceRequests.push({
        playerName: match.playerName,
        requestedName: match.matchedName,
        sourceColumn: match.sourceColumn,
      });
    }
  }

  return {
    hardGroups,
    requestMatches,
    autoMatchedRequests: requestMatches.filter(match => ['nickname', 'partial', 'fuzzy'].includes(match.status)),
    reviewNeededRequests: requestMatches.filter(match => ['ambiguous', 'unmatched'].includes(match.status)),
    niceToPlayMappings,
    ignoredOneWayNiceRequests,
  };
}

export function buildRequestMappingReport(audit: RequestMappingAudit): string {
  const lines = [
    '# Request Mapping Audit',
    '',
    '## Summary',
    '',
    `- Hard must-play groups: ${audit.hardGroups.length}`,
    `- Mutual nice-to-play mappings: ${audit.niceToPlayMappings.length}`,
    `- Ignored one-way nice-to-play requests: ${audit.ignoredOneWayNiceRequests.length}`,
    `- Auto-matched spelling/name variants: ${audit.autoMatchedRequests.length}`,
    `- Needs review: ${audit.reviewNeededRequests.length}`,
    '',
    '## Hard must-play groups',
    '',
  ];

  if (audit.hardGroups.length === 0) {
    lines.push('- None');
  } else {
    audit.hardGroups.forEach((group, index) => {
      lines.push(`${index + 1}. ${group.playerNames.join(' + ')}`);
    });
  }

  lines.push('', '## Auto-matched names', '');
  if (audit.autoMatchedRequests.length === 0) {
    lines.push('- None');
  } else {
    for (const match of audit.autoMatchedRequests) {
      lines.push(`- ${match.playerName} (${match.sourceColumn}): "${match.inputName}" -> ${match.matchedName} [${match.status}]`);
    }
  }

  lines.push('', '## Needs review before relying on the request', '');
  if (audit.reviewNeededRequests.length === 0) {
    lines.push('- None');
  } else {
    for (const match of audit.reviewNeededRequests) {
      const candidates = match.candidates?.length ? ` Candidates: ${match.candidates.join(', ')}` : '';
      lines.push(`- ${match.playerName} (${match.sourceColumn}): "${match.inputName}" [${match.status}].${candidates}`);
    }
  }

  lines.push('', '## Mutual nice-to-play mappings', '');
  if (audit.niceToPlayMappings.length === 0) {
    lines.push('- None');
  } else {
    for (const mapping of audit.niceToPlayMappings) {
      lines.push(`- ${mapping.playerName} <-> ${mapping.requestedName}`);
    }
  }

  lines.push('', '## Ignored one-way nice-to-play requests', '');
  if (audit.ignoredOneWayNiceRequests.length === 0) {
    lines.push('- None');
  } else {
    for (const mapping of audit.ignoredOneWayNiceRequests) {
      lines.push(`- ${mapping.playerName} -> ${mapping.requestedName}`);
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

export function buildSeasonDraftFromRows(options: BuildOptions): SeasonDraftResult {
  if (!Number.isInteger(options.teamCount) || options.teamCount < 1) {
    throw new Error('teamCount must be a positive integer.');
  }

  const players = parseRosterRows(options.rows);
  const targetTeamSize = options.maxTeamSize ?? Math.ceil(players.length / options.teamCount);
  const hardGroups = buildHardGroups(players);
  applyMutualNiceToPlayRules(players, hardGroups);
  validateHardGroups(players, hardGroups, targetTeamSize);
  const teams = assignPlayersToTeams(players, hardGroups, options.teamCount, targetTeamSize, options.draftSeed ?? 0);
  const metrics = buildDraftMetrics(teams, players, hardGroups);

  return {
    seasonName: options.seasonName,
    variationName: options.variationName,
    teams,
    players,
    hardGroups,
    metrics,
    hardRulesPassed: metrics.avoidViolations === 0
      && metrics.hardGroupViolations === 0
      && metrics.genderSpreadViolations === 0,
  };
}

export function buildSeasonReport(result: SeasonDraftResult): string {
  const { metrics } = result;
  const title = result.variationName
    ? `${result.seasonName} ${result.variationName} Team Draft Validation`
    : `${result.seasonName} Team Draft Validation`;
  const lines = [
    `# ${title}`,
    '',
    `Hard rules: ${result.hardRulesPassed ? 'PASS' : 'FAIL'}`,
    '',
    '## Summary',
    '',
    `- Players: ${metrics.playerCount}`,
    `- Teams: ${metrics.teamCount}`,
    `- Hard groups: ${result.hardGroups.length}`,
    `- Team size spread: ${metrics.teamSizeSpread}`,
    `- Male spread: ${metrics.maleSpread}`,
    `- Female spread: ${metrics.femaleSpread}`,
    `- Gender spread violations: ${metrics.genderSpreadViolations}`,
    `- Female leader teams: ${metrics.femaleLeaderTeams}/${metrics.teamCount}`,
    `- Male leader covered teams: ${metrics.maleLeaderCoveredTeams}/${metrics.teamCount}`,
    `- Skill spread: ${metrics.skillSpread.toFixed(2)}`,
    `- Handler spread: ${metrics.handlerSpread}`,
    `- Mutual nice-to-play honored/broken: ${metrics.niceToPlayHonored}/${metrics.niceToPlayBroken}`,
    `- Mutual nice-to-play honor rate: ${Math.round(metrics.niceToPlayHonorRate * 100)}%`,
    `- Mutual nice-to-play 75% target: ${metrics.niceToPlayTargetMet ? 'PASS' : 'FAIL'}`,
    `- New player spread: ${metrics.newPlayerSpread}`,
    `- Young player spread: ${metrics.youngPlayerSpread}`,
    `- Wise player spread: ${metrics.wisePlayerSpread}`,
    '',
    '## Teams',
    '',
  ];

  for (const team of result.teams) {
    const averageSkill = average(team.players.map(getEffectiveSkill));
    const maleCount = team.players.filter(player => player.gender === 'M').length;
    const femaleCount = team.players.filter(player => player.gender === 'F').length;
    const handlerCount = team.players.filter(player => player.isHandler).length;
    lines.push(`### ${team.name}`);
    lines.push('');
    lines.push(`- Players: ${team.players.length}`);
    lines.push(`- Gender: ${maleCount}M / ${femaleCount}F`);
    lines.push(`- Avg skill: ${averageSkill.toFixed(2)}`);
    lines.push(`- Handlers: ${handlerCount}`);
    lines.push(`- Roster: ${team.players.map(player => player.name).join(', ')}`);
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

export function buildGeneratedTeamsCsv(result: SeasonDraftResult): string {
  return Papa.unparse(result.teams.flatMap(team =>
    team.players.map(player => ({
      Team: team.name,
      Name: player.name,
      Gender: player.gender,
      Skill: getEffectiveSkill(player),
      'Exec Skill Rating': player.execSkillRating ?? '',
      Handler: player.isHandler ? 'Yes' : 'No',
      Labels: player.labels.join('; '),
    }))
  ));
}

export function buildNormalizedRosterCsv(players: DraftPlayer[]): string {
  return Papa.unparse(players.map(player => ({
    Name: player.name,
    Gender: player.gender,
    'Skill Rating': player.skillRating,
    'Exec Skill Rating': player.execSkillRating ?? '',
    'Teammate Requests': player.playerRequests.join('; '),
    'Avoid Requests': player.avoidRequests.join('; '),
    Email: getString(player.sourceRow, ['Email', 'email']),
    'New Player': player.isNewPlayer === undefined ? '' : player.isNewPlayer ? 'Yes' : 'No',
    Age: player.age ?? '',
    'Registration Notes': getString(player.sourceRow, ['Other_Notes', 'Other Notes', 'Registration Notes']),
    Handler: player.isHandler ? 'Yes' : 'No',
    Labels: player.labels.join('; '),
  })));
}

export function readWorkbookRows(workbookPath: string, sheetName = 'Roster Self Rank'): WorkbookRow[] {
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const isCsv = path.extname(workbookPath).toLowerCase() === '.csv';
  const fallbackSheetName = isCsv ? workbook.SheetNames[0] : undefined;
  const sheet = workbook.Sheets[sheetName] ?? (fallbackSheetName ? workbook.Sheets[fallbackSheetName] : undefined);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" was not found in ${workbookPath}.`);
  }

  return XLSX.utils.sheet_to_json<WorkbookRow>(sheet, { defval: '' });
}

export async function writeDraftOutputs(input: {
  workbookPath: string;
  sheetName?: string;
  teamCount: number;
  seasonName: string;
  outDir: string;
  maxTeamSize?: number;
  variationCount?: number;
  draftSeeds?: number[];
}) {
  const rows = readWorkbookRows(input.workbookPath, input.sheetName);
  validateWorkbookRowsForDrafting(rows);

  await fs.mkdir(input.outDir, { recursive: true });
  const safeSeason = input.seasonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'season';
  const rosterPath = path.join(input.outDir, `${safeSeason}-normalized-roster.csv`);
  const requestMappingPath = path.join(input.outDir, `${safeSeason}-request-mapping-audit.md`);
  const requestMappingJsonPath = path.join(input.outDir, `${safeSeason}-request-mapping-audit.json`);
  const draftSeeds = input.draftSeeds && input.draftSeeds.length > 0
    ? input.draftSeeds
    : Array.from({ length: Math.max(1, input.variationCount ?? 1) }, (_value, index) =>
      input.variationCount === 1 ? 0 : index + 1
    );
  const variationCount = draftSeeds.length;
  const variations = draftSeeds.map((draftSeed, index) => buildSeasonDraftFromRows({
    rows,
    teamCount: input.teamCount,
    seasonName: input.seasonName,
    maxTeamSize: input.maxTeamSize,
    draftSeed,
    variationName: variationCount === 1 ? undefined : `Variation ${index + 1}`,
  }));
  const result = variations[0];
  if (!result) {
    throw new Error('No draft variations were generated.');
  }
  const requestMappingAudit = buildRequestMappingAudit(result.players, result.hardGroups);

  await fs.writeFile(rosterPath, buildNormalizedRosterCsv(result.players), 'utf8');
  await fs.writeFile(requestMappingPath, buildRequestMappingReport(requestMappingAudit), 'utf8');
  await fs.writeFile(requestMappingJsonPath, JSON.stringify(requestMappingAudit, null, 2), 'utf8');

  const variationOutputs = [];
  for (const [index, variationResult] of variations.entries()) {
    const variationSuffix = variationCount === 1 ? '' : `-variation-${index + 1}`;
    const teamsPath = path.join(input.outDir, `${safeSeason}${variationSuffix}-generated-teams.csv`);
    const reportPath = path.join(input.outDir, `${safeSeason}${variationSuffix}-validation-report.md`);
    const auditPath = path.join(input.outDir, `${safeSeason}${variationSuffix}-draft-audit.json`);

    await fs.writeFile(teamsPath, buildGeneratedTeamsCsv(variationResult), 'utf8');
    await fs.writeFile(reportPath, buildSeasonReport(variationResult), 'utf8');
    await fs.writeFile(auditPath, JSON.stringify({
      seasonName: variationResult.seasonName,
      variationName: variationResult.variationName,
      hardGroups: variationResult.hardGroups,
      metrics: variationResult.metrics,
      requestMapping: {
        autoMatchedRequests: requestMappingAudit.autoMatchedRequests.length,
        reviewNeededRequests: requestMappingAudit.reviewNeededRequests.length,
        niceToPlayMappings: requestMappingAudit.niceToPlayMappings.length,
        ignoredOneWayNiceRequests: requestMappingAudit.ignoredOneWayNiceRequests.length,
      },
      teams: variationResult.teams.map(team => ({
        name: team.name,
        players: team.players.map(player => player.name),
      })),
    }, null, 2), 'utf8');

    variationOutputs.push({
      result: variationResult,
      teamsPath,
      reportPath,
      auditPath,
    });
  }

  const summaryPath = path.join(input.outDir, `${safeSeason}-variations-summary.md`);
  if (variationCount > 1) {
    await fs.writeFile(summaryPath, buildVariationsSummaryReport(variations), 'utf8');
  }

  return {
    result,
    rosterPath,
    teamsPath: variationOutputs[0]?.teamsPath,
    reportPath: variationOutputs[0]?.reportPath,
    auditPath: variationOutputs[0]?.auditPath,
    requestMappingPath,
    requestMappingJsonPath,
    summaryPath: variationCount > 1 ? summaryPath : undefined,
    variations: variationOutputs,
  };
}

export function buildVariationsSummaryReport(results: SeasonDraftResult[]): string {
  const lines = [
    '# Team Draft Variation Summary',
    '',
    '| Variation | Hard rules | Team sizes | Gender spread | Gender violations | Skill spread | Handler spread | Female leaders | Male leaders | Nice honored/broken | Nice rate | Nice target | New spread | Young/Wise spread |',
    '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];

  for (const [index, result] of results.entries()) {
    const metrics = result.metrics;
    lines.push([
      result.variationName ?? `Variation ${index + 1}`,
      result.hardRulesPassed ? 'PASS' : 'FAIL',
      result.teams.map(team => team.players.length).join(', '),
      `${metrics.maleSpread}M / ${metrics.femaleSpread}F`,
      String(metrics.genderSpreadViolations),
      metrics.skillSpread.toFixed(2),
      String(metrics.handlerSpread),
      `${metrics.femaleLeaderTeams}/${metrics.teamCount}`,
      `${metrics.maleLeaderCoveredTeams}/${metrics.teamCount}`,
      `${metrics.niceToPlayHonored}/${metrics.niceToPlayBroken}`,
      `${Math.round(metrics.niceToPlayHonorRate * 100)}%`,
      metrics.niceToPlayTargetMet ? 'PASS' : 'FAIL',
      String(metrics.newPlayerSpread),
      `${metrics.youngPlayerSpread}/${metrics.wisePlayerSpread}`,
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  return `${lines.join('\n').trim()}\n`;
}

const FIRST_NAME_EQUIVALENTS = [
  ['andrew', 'andy'],
  ['caitlind', 'caitland'],
  ['cameron', 'cam'],
  ['eric', 'erik'],
  ['jeffery', 'jeffrey', 'jeff'],
  ['lilyanna', 'lily'],
  ['matthew', 'matt', 'mat'],
  ['michael', 'mike'],
  ['nathan', 'nate'],
  ['pascale', 'pascal'],
  ['peter', 'pete'],
  ['rebecca', 'becca', 'becky', 'beccs'],
  ['sara', 'sarah'],
  ['stephen', 'steve'],
  ['thomas', 'tom'],
  ['tracy', 'tracey'],
];

function resolveRequestsForPlayers(players: DraftPlayer[]): void {
  for (const player of players) {
    const requestMatches: RequestNameMatch[] = [];

    player.playerRequests = resolveRequestList(players, player, player.playerRequests, 'Player Requests', requestMatches);
    player.niceToPlayRequests = resolveRequestList(players, player, player.niceToPlayRequests, 'Would like to play with', requestMatches);
    player.avoidRequests = resolveRequestList(players, player, player.avoidRequests, 'Do_Not_Play', requestMatches);
    player.requestMatches = requestMatches;
  }
}

function resolveRequestList(
  players: DraftPlayer[],
  player: DraftPlayer,
  requestedNames: string[],
  sourceColumn: RequestSourceColumn,
  requestMatches: RequestNameMatch[],
): string[] {
  return unique(requestedNames.map(inputName => {
    const match = resolveRequestedName(players, player.name, sourceColumn, inputName);
    requestMatches.push(match);

    if (match.matchedName && namesMatch(match.matchedName, player.name)) {
      return '';
    }

    return match.matchedName ?? inputName;
  }));
}

function resolveRequestedName(
  players: DraftPlayer[],
  playerName: string,
  sourceColumn: RequestSourceColumn,
  inputName: string,
): RequestNameMatch {
  const cleanedInput = cleanRequestedName(inputName);
  const candidates = players.filter(player => !namesMatch(player.name, playerName));
  const baseMatch = {
    playerName,
    sourceColumn,
    inputName,
  };

  if (!cleanedInput) {
    return { ...baseMatch, status: 'unmatched' };
  }

  const exactMatches = candidates.filter(candidate => normalizeName(candidate.name) === normalizeName(cleanedInput));
  if (exactMatches.length === 1) {
    return {
      ...baseMatch,
      status: 'exact',
      matchedName: exactMatches[0].name,
      score: 1,
    };
  }

  const nicknameMatches = candidates
    .map(candidate => ({
      player: candidate,
      score: firstAndLastNameScore(cleanedInput, candidate.name),
    }))
    .filter(candidate => candidate.score >= 0.86)
    .sort((left, right) => right.score - left.score);

  if (isClearBestMatch(nicknameMatches)) {
    return {
      ...baseMatch,
      status: 'nickname',
      matchedName: nicknameMatches[0].player.name,
      score: round2(nicknameMatches[0].score),
      candidates: nicknameMatches.slice(0, 3).map(match => match.player.name),
    };
  }

  const partialMatches = candidates.filter(candidate => isPartialNameMatch(cleanedInput, candidate.name));
  if (partialMatches.length === 1) {
    return {
      ...baseMatch,
      status: 'partial',
      matchedName: partialMatches[0].name,
      score: 0.95,
    };
  }

  const fuzzyMatches = candidates
    .map(candidate => ({
      player: candidate,
      score: stringSimilarity(normalizeAlpha(cleanedInput), normalizeAlpha(candidate.name)),
    }))
    .sort((left, right) => right.score - left.score);

  if (isClearBestMatch(fuzzyMatches) && fuzzyMatches[0].score >= 0.86) {
    return {
      ...baseMatch,
      status: 'fuzzy',
      matchedName: fuzzyMatches[0].player.name,
      score: round2(fuzzyMatches[0].score),
      candidates: fuzzyMatches.slice(0, 3).map(match => match.player.name),
    };
  }

  const reviewCandidates = [...nicknameMatches, ...fuzzyMatches]
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, allCandidates) =>
      index === allCandidates.findIndex(match => match.player.name === candidate.player.name)
    )
    .slice(0, 5);

  if (reviewCandidates[0]?.score >= 0.7) {
    return {
      ...baseMatch,
      status: 'ambiguous',
      score: round2(reviewCandidates[0].score),
      candidates: reviewCandidates.map(match => match.player.name),
    };
  }

  return {
    ...baseMatch,
    status: 'unmatched',
    candidates: reviewCandidates.map(match => match.player.name),
  };
}

function cleanRequestedName(name: string): string {
  return name
    .replace(/[’‘]/g, "'")
    .replace(/^would\s+like\s+to\s+play\s+with\s+/i, '')
    .replace(/^play\s+with\s+/i, '')
    .trim();
}

function firstAndLastNameScore(inputName: string, candidateName: string): number {
  const inputParts = normalizeName(inputName).split(' ').filter(Boolean);
  const candidateParts = normalizeName(candidateName).split(' ').filter(Boolean);

  if (inputParts.length < 2 || candidateParts.length < 2) {
    return 0;
  }

  const inputFirst = inputParts[0];
  const candidateFirst = candidateParts[0];
  const inputLast = inputParts[inputParts.length - 1];
  const candidateLast = candidateParts[candidateParts.length - 1];

  if (!firstNamesEquivalent(inputFirst, candidateFirst)) {
    return 0;
  }

  const lastScore = stringSimilarity(normalizeAlpha(inputLast), normalizeAlpha(candidateLast));
  return 0.7 + (lastScore * 0.3);
}

function firstNamesEquivalent(left: string, right: string): boolean {
  const normalizedLeft = normalizeAlpha(left);
  const normalizedRight = normalizeAlpha(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  return FIRST_NAME_EQUIVALENTS.some(group =>
    group.includes(normalizedLeft) && group.includes(normalizedRight)
  );
}

function isPartialNameMatch(inputName: string, candidateName: string): boolean {
  const inputAlpha = normalizeAlpha(inputName);
  const candidateAlpha = normalizeAlpha(candidateName);

  return inputAlpha.length >= 5
    && candidateAlpha.length >= 5
    && (inputAlpha.includes(candidateAlpha) || candidateAlpha.includes(inputAlpha));
}

function isClearBestMatch<T extends { score: number }>(matches: T[]): boolean {
  if (matches.length === 0) {
    return false;
  }

  return matches.length === 1 || matches[0].score - matches[1].score >= 0.04;
}

function stringSimilarity(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  const distance = levenshteinDistance(left, right);
  return 1 - (distance / Math.max(left.length, right.length));
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function normalizeAlpha(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildHardGroups(players: DraftPlayer[]): HardGroup[] {
  const parent = new Map<string, string>();
  const sourceByRoot = new Map<string, Set<HardGroup['source']>>();
  players.forEach(player => parent.set(player.name, player.name));

  const explicitGroups = new Map<string, DraftPlayer[]>();
  for (const player of players) {
    if (!player.mustPlayGroup) {
      continue;
    }
    const key = player.mustPlayGroup.trim().toLowerCase();
    explicitGroups.set(key, [...(explicitGroups.get(key) ?? []), player]);
  }

  for (const groupPlayers of explicitGroups.values()) {
    for (let index = 1; index < groupPlayers.length; index += 1) {
      union(parent, groupPlayers[0].name, groupPlayers[index].name);
      addSource(sourceByRoot, find(parent, groupPlayers[0].name), 'explicit');
    }
  }

  for (const player of players) {
    for (const requestedName of player.playerRequests) {
      const requestedPlayer = findPlayer(players, requestedName);
      if (!requestedPlayer) {
        continue;
      }

      const isMutual = requestedPlayer.playerRequests.some(name => namesMatch(name, player.name));
      if (isMutual) {
        union(parent, player.name, requestedPlayer.name);
        addSource(sourceByRoot, find(parent, player.name), 'mutual-request');
      }
    }
  }

  const groups = new Map<string, DraftPlayer[]>();
  for (const player of players) {
    const root = find(parent, player.name);
    groups.set(root, [...(groups.get(root) ?? []), player]);
  }

  return Array.from(groups.entries())
    .filter(([, groupPlayers]) => groupPlayers.length > 1)
    .map(([root, groupPlayers], index) => {
      const sourceSet = sourceByRoot.get(find(parent, root)) ?? new Set<HardGroup['source']>(['mutual-request']);
      const source = sourceSet.size > 1 ? 'mixed' : Array.from(sourceSet)[0] ?? 'mutual-request';
      return {
        id: `hard-group-${index + 1}`,
        playerNames: groupPlayers.map(player => player.name),
        source,
      };
    });
}

function applyMutualNiceToPlayRules(players: DraftPlayer[], hardGroups: HardGroup[]): void {
  const hardPairKeys = new Set(hardGroups.flatMap(group => buildPairKeys(group.playerNames)));
  const mutualNiceByPlayer = new Map(players.map(player => [player.name, new Set<string>()]));

  for (let leftIndex = 0; leftIndex < players.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < players.length; rightIndex += 1) {
      const left = players[leftIndex];
      const right = players[rightIndex];
      const pairKey = buildPairKey(left.name, right.name);

      if (hardPairKeys.has(pairKey)) {
        continue;
      }

      const leftWantsRight = hasSoftRequestIntent(left, right);
      const rightWantsLeft = hasSoftRequestIntent(right, left);

      if (!leftWantsRight || !rightWantsLeft) {
        continue;
      }

      mutualNiceByPlayer.get(left.name)?.add(right.name);
      mutualNiceByPlayer.get(right.name)?.add(left.name);
    }
  }

  for (const player of players) {
    player.niceToPlayRequests = Array.from(mutualNiceByPlayer.get(player.name) ?? []);
  }
}

function hasSoftRequestIntent(player: DraftPlayer, requestedPlayer: DraftPlayer): boolean {
  return player.niceToPlayRequests.some(name => namesMatch(name, requestedPlayer.name))
    || player.playerRequests.some(name => namesMatch(name, requestedPlayer.name));
}

function buildPairKeys(playerNames: string[]): string[] {
  const pairKeys = [];
  for (let leftIndex = 0; leftIndex < playerNames.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < playerNames.length; rightIndex += 1) {
      pairKeys.push(buildPairKey(playerNames[leftIndex], playerNames[rightIndex]));
    }
  }
  return pairKeys;
}

function buildPairKey(left: string, right: string): string {
  return [normalizeName(left), normalizeName(right)].sort().join('|');
}

function validateHardGroups(players: DraftPlayer[], groups: HardGroup[], targetTeamSize: number): void {
  for (const group of groups) {
    if (group.playerNames.length > targetTeamSize) {
      throw new Error(`Hard group ${group.id} (${group.playerNames.join(', ')}) is larger than target team size ${targetTeamSize}.`);
    }

    for (const playerName of group.playerNames) {
      const player = findPlayer(players, playerName);
      if (!player) {
        continue;
      }

      const conflictedName = group.playerNames.find(candidate =>
        candidate !== player.name && player.avoidRequests.some(avoidName => namesMatch(avoidName, candidate))
      );
      if (conflictedName) {
        throw new Error(`Hard group ${group.id} contains an avoid conflict: ${player.name} / ${conflictedName}.`);
      }
    }
  }
}

function buildDraftUnits(
  players: DraftPlayer[],
  groups: HardGroup[],
  includeNiceClusters = false,
  maxClusterSize = players.length,
): DraftUnit[] {
  if (includeNiceClusters) {
    return buildDraftUnitsWithNiceClusters(players, groups, maxClusterSize);
  }

  const groupedNames = new Set(groups.flatMap(group => group.playerNames.map(normalizeName)));
  const units = groups.map(group => ({
    id: group.id,
    players: group.playerNames
      .map(name => findPlayer(players, name))
      .filter((player): player is DraftPlayer => Boolean(player)),
  }));

  for (const player of players) {
    if (!groupedNames.has(normalizeName(player.name))) {
      units.push({ id: `player-${normalizeName(player.name)}`, players: [player] });
    }
  }

  return units;
}

function buildDraftUnitsWithNiceClusters(players: DraftPlayer[], groups: HardGroup[], maxClusterSize: number): DraftUnit[] {
  const parent = new Map<string, string>();
  players.forEach(player => parent.set(player.name, player.name));

  for (const group of groups) {
    for (let index = 1; index < group.playerNames.length; index += 1) {
      union(parent, group.playerNames[0], group.playerNames[index]);
    }
  }

  for (const player of players) {
    for (const requestedName of player.niceToPlayRequests) {
      const requestedPlayer = findPlayer(players, requestedName);
      if (!requestedPlayer) {
        continue;
      }

      const currentCluster = players.filter(candidate =>
        find(parent, candidate.name) === find(parent, player.name)
        || find(parent, candidate.name) === find(parent, requestedPlayer.name)
      );

      if (unitCreatesAvoidConflict([player], [requestedPlayer])) {
        continue;
      }

      const nextClusterNames = unique([...currentCluster.map(candidate => candidate.name), player.name, requestedPlayer.name]);
      const nextClusterPlayers = nextClusterNames
        .map(name => findPlayer(players, name))
        .filter((candidate): candidate is DraftPlayer => Boolean(candidate));

      if (nextClusterPlayers.length > maxClusterSize) {
        continue;
      }

      union(parent, player.name, requestedPlayer.name);
    }
  }

  const grouped = new Map<string, DraftPlayer[]>();
  for (const player of players) {
    const root = find(parent, player.name);
    grouped.set(root, [...(grouped.get(root) ?? []), player]);
  }

  return Array.from(grouped.values()).map((clusterPlayers, index) => ({
    id: clusterPlayers.length > 1 ? `cluster-${index + 1}` : `player-${normalizeName(clusterPlayers[0].name)}`,
    players: clusterPlayers,
  }));
}

function assignPlayersToTeams(
  players: DraftPlayer[],
  hardGroups: HardGroup[],
  teamCount: number,
  targetTeamSize: number,
  draftSeed: number,
): DraftTeam[] {
  const niceClusterSizes = uniqueNumbers([
    targetTeamSize,
    Math.min(8, targetTeamSize),
    Math.min(5, targetTeamSize),
    2,
  ]).filter(size => size >= 2);

  const candidateUnitSets = [
    ...niceClusterSizes.map(maxClusterSize => buildDraftUnits(players, hardGroups, true, maxClusterSize)),
    buildDraftUnits(players, hardGroups, false, targetTeamSize),
  ];

  let bestTeams: DraftTeam[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidateUnitSets.forEach((units, index) => {
    const teams = assignUnitsToTeams(units, players, teamCount, targetTeamSize, draftSeed + index * 17);
    const score = scoreTeams(teams, players, hardGroups);
    if (score < bestScore) {
      bestScore = score;
      bestTeams = teams;
    }
  });

  if (!bestTeams) {
    throw new Error('No team draft could be built.');
  }

  return bestTeams;
}

function assignUnitsToTeams(
  units: DraftUnit[],
  players: DraftPlayer[],
  teamCount: number,
  maxTeamSize: number,
  draftSeed: number,
): DraftTeam[] {
  const orders = buildCandidateOrders(units, draftSeed);
  const targetVariants = buildTeamTargetVariants(players, teamCount, draftSeed);
  let bestTeams: DraftTeam[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const targets of targetVariants) {
    for (const order of orders) {
      const teams = createEmptyTeams(teamCount, targets);
      let failedOrder = false;

      for (const unit of order) {
        const candidates = teams.filter(team =>
          unitFitsTeam(unit, team, maxTeamSize)
          && !unitCreatesAvoidConflict(unit.players, team.players)
        );

        if (candidates.length === 0) {
          failedOrder = true;
          break;
        }

        let bestTeam = candidates[0];
        let bestCandidateScore = Number.POSITIVE_INFINITY;
        for (const team of candidates) {
          const nextTeams = teams.map(candidate => candidate.id === team.id
            ? { ...candidate, players: [...candidate.players, ...unit.players] }
            : candidate);
          const score = scoreTeams(nextTeams, players, []);
          if (score < bestCandidateScore) {
            bestCandidateScore = score;
            bestTeam = team;
          }
        }

        bestTeam.players.push(...unit.players);
      }

      if (failedOrder) {
        if (order.length > 75) {
          continue;
        }
        const backtrackedTeams = assignOrderWithBacktracking(order, players, teamCount, maxTeamSize, targets);
        if (backtrackedTeams) {
          const score = scoreTeams(backtrackedTeams, players, []);
          if (score < bestScore) {
            bestScore = score;
            bestTeams = backtrackedTeams;
          }
        }
        continue;
      }

      const score = scoreTeams(teams, players, []);
      if (score < bestScore) {
        bestScore = score;
        bestTeams = teams;
      }
    }
  }

  if (!bestTeams) {
    throw new Error('No team draft could be built.');
  }

  return bestTeams;
}

function assignOrderWithBacktracking(
  order: DraftUnit[],
  players: DraftPlayer[],
  teamCount: number,
  maxTeamSize: number,
  targets: TeamTargets[],
): DraftTeam[] | null {
  const teams = createEmptyTeams(teamCount, targets);
  const backtrackingOrder = buildBacktrackingOrder(order);
  const includePlayerNamesInState = playersHaveResolvableAvoidRequests(players);

  function place(unitIndex: number): DraftTeam[] | null {
    if (unitIndex >= backtrackingOrder.length) {
      return teams.map(team => ({
        ...team,
        players: [...team.players],
      }));
    }

    const unit = backtrackingOrder[unitIndex];
    const candidates = teams
      .filter(team =>
        unitFitsTeam(unit, team, maxTeamSize)
        && !unitCreatesAvoidConflict(unit.players, team.players)
      )
      .sort((left, right) => compareBacktrackingCandidates(left, right, unit));

    const seenTeamStates = new Set<string>();
    for (const team of candidates) {
      const stateKey = buildBacktrackingTeamStateKey(team, includePlayerNamesInState);
      if (seenTeamStates.has(stateKey)) {
        continue;
      }
      seenTeamStates.add(stateKey);

      team.players.push(...unit.players);
      const result = place(unitIndex + 1);
      if (result) {
        return result;
      }
      team.players.splice(team.players.length - unit.players.length, unit.players.length);
    }

    return null;
  }

  return place(0);
}

function buildBacktrackingOrder(order: DraftUnit[]): DraftUnit[] {
  return [...order].sort((left, right) => {
    const leftGenderCounts = countGenderValues(left.players);
    const rightGenderCounts = countGenderValues(right.players);
    return right.players.length - left.players.length
      || rightGenderCounts.male - leftGenderCounts.male
      || rightGenderCounts.female - leftGenderCounts.female
      || average(right.players.map(getEffectiveSkill)) - average(left.players.map(getEffectiveSkill));
  });
}

function compareBacktrackingCandidates(left: TargetedDraftTeam, right: TargetedDraftTeam, unit: DraftUnit): number {
  const leftRemainingSlots = getRemainingTargetSlots(left, unit);
  const rightRemainingSlots = getRemainingTargetSlots(right, unit);
  return leftRemainingSlots - rightRemainingSlots
    || left.players.length - right.players.length
    || left.id.localeCompare(right.id);
}

function getRemainingTargetSlots(team: TargetedDraftTeam, unit: DraftUnit): number {
  return (team.targets?.size ?? Number.POSITIVE_INFINITY) - team.players.length - unit.players.length;
}

function buildBacktrackingTeamStateKey(team: TargetedDraftTeam, includePlayerNames: boolean): string {
  const genderCounts = countGenderValues(team.players);
  const parts = [
    team.targets?.size ?? 'any',
    team.targets?.male ?? 'any',
    team.targets?.female ?? 'any',
    team.targets?.other ?? 'any',
    team.players.length,
    genderCounts.male,
    genderCounts.female,
    genderCounts.other,
  ];

  if (includePlayerNames) {
    parts.push(team.players.map(player => normalizeName(player.name)).sort().join(','));
  }

  return parts.join('|');
}

function playersHaveResolvableAvoidRequests(players: DraftPlayer[]): boolean {
  return players.some(player =>
    player.avoidRequests.some(avoidName => Boolean(findPlayer(players, avoidName)))
  );
}

function buildTeamTargetVariants(players: DraftPlayer[], teamCount: number, draftSeed: number): TeamTargets[][] {
  const targets = buildBalancedTeamTargets(players, teamCount);
  if (!targets) {
    return [[]];
  }

  return [
    targets,
    [...targets].reverse(),
    seededShuffle(targets, draftSeed * 101 + 43),
    seededShuffle(targets, draftSeed * 101 + 59),
    rotateUnits(targets, draftSeed + 1),
  ];
}

function buildBalancedTeamTargets(players: DraftPlayer[], teamCount: number): TeamTargets[] | null {
  const totals = countGenderValues(players);
  const totalPlayers = players.length;
  const sizeLow = Math.floor(totalPlayers / teamCount);
  const sizeHigh = Math.ceil(totalPlayers / teamCount);
  const maleLow = Math.floor(totals.male / teamCount);
  const maleHigh = Math.ceil(totals.male / teamCount);
  const femaleLow = Math.floor(totals.female / teamCount);
  const femaleHigh = Math.ceil(totals.female / teamCount);
  const otherLow = Math.floor(totals.other / teamCount);
  const otherHigh = Math.ceil(totals.other / teamCount);
  const possibleTargets: TeamTargets[] = [];

  for (const male of uniqueNumbers([maleLow, maleHigh])) {
    for (const female of uniqueNumbers([femaleLow, femaleHigh])) {
      for (const other of uniqueNumbers([otherLow, otherHigh])) {
        const size = male + female + other;
        if (size === sizeLow || size === sizeHigh) {
          possibleTargets.push({ size, male, female, other });
        }
      }
    }
  }

  const orderedTargets = possibleTargets.sort((left, right) =>
    right.size - left.size
    || right.female - left.female
    || right.male - left.male
  );

  return searchTeamTargets({
    possibleTargets: orderedTargets,
    remainingTeams: teamCount,
    remainingMale: totals.male,
    remainingFemale: totals.female,
    remainingOther: totals.other,
  });
}

function searchTeamTargets(input: {
  possibleTargets: TeamTargets[];
  remainingTeams: number;
  remainingMale: number;
  remainingFemale: number;
  remainingOther: number;
}): TeamTargets[] | null {
  if (input.remainingTeams === 0) {
    return input.remainingMale === 0 && input.remainingFemale === 0 && input.remainingOther === 0
      ? []
      : null;
  }

  for (const target of input.possibleTargets) {
    if (
      target.male > input.remainingMale
      || target.female > input.remainingFemale
      || target.other > input.remainingOther
    ) {
      continue;
    }

    const rest = searchTeamTargets({
      possibleTargets: input.possibleTargets,
      remainingTeams: input.remainingTeams - 1,
      remainingMale: input.remainingMale - target.male,
      remainingFemale: input.remainingFemale - target.female,
      remainingOther: input.remainingOther - target.other,
    });

    if (rest) {
      return [target, ...rest];
    }
  }

  return null;
}

function unitFitsTeam(unit: DraftUnit, team: TargetedDraftTeam, maxTeamSize: number): boolean {
  const nextSize = team.players.length + unit.players.length;
  if (nextSize > (team.targets?.size ?? maxTeamSize)) {
    return false;
  }

  if (!team.targets) {
    return true;
  }

  const teamGenderCounts = countGenderValues(team.players);
  const unitGenderCounts = countGenderValues(unit.players);

  return teamGenderCounts.male + unitGenderCounts.male <= team.targets.male
    && teamGenderCounts.female + unitGenderCounts.female <= team.targets.female
    && teamGenderCounts.other + unitGenderCounts.other <= team.targets.other;
}

function countGenderValues(players: DraftPlayer[]) {
  return {
    male: players.filter(player => player.gender === 'M').length,
    female: players.filter(player => player.gender === 'F').length,
    other: players.filter(player => player.gender === 'Other').length,
  };
}

function buildCandidateOrders(units: DraftUnit[], draftSeed: number): DraftUnit[][] {
  const base = [...units].sort((a, b) => {
    const leaderDelta = countLeaders(b.players) - countLeaders(a.players);
    if (leaderDelta !== 0) {
      return leaderDelta;
    }

    if (b.players.length !== a.players.length) {
      return b.players.length - a.players.length;
    }

    return average(b.players.map(getEffectiveSkill)) - average(a.players.map(getEffectiveSkill));
  });

  if (draftSeed > 0) {
    const skillFirst = [...base].sort((a, b) =>
      average(b.players.map(getEffectiveSkill)) - average(a.players.map(getEffectiveSkill))
    );
    const genderFirst = [...base].sort((a, b) => {
      const femaleDelta = b.players.filter(player => player.gender === 'F').length - a.players.filter(player => player.gender === 'F').length;
      if (femaleDelta !== 0) {
        return femaleDelta;
      }
      return average(b.players.map(getEffectiveSkill)) - average(a.players.map(getEffectiveSkill));
    });

    return [
      seededShuffle(base, draftSeed * 101 + 11),
      seededShuffle(skillFirst, draftSeed * 101 + 23),
      seededShuffle(genderFirst, draftSeed * 101 + 37),
      rotateUnits(base, draftSeed * 7),
      rotateUnits([...base].reverse(), draftSeed * 5),
    ];
  }

  return [
    base,
    [...base].reverse(),
    seededShuffle(base, 11),
    seededShuffle(base, 23),
    seededShuffle(base, 37),
  ];
}

function buildDraftMetrics(teams: DraftTeam[], players: DraftPlayer[], hardGroups: HardGroup[]): DraftMetrics {
  const maleCounts = teams.map(team => team.players.filter(player => player.gender === 'M').length);
  const femaleCounts = teams.map(team => team.players.filter(player => player.gender === 'F').length);
  const teamSizes = teams.map(team => team.players.length);
  const skillAverages = teams.map(team => average(team.players.map(getEffectiveSkill)));
  const handlerCounts = teams.map(team => team.players.filter(player => player.isHandler).length);
  const femaleLeaderCounts = teams.map(team => team.players.filter(player => player.gender === 'F' && (
    player.labels.includes('leader-a-female')
    || player.labels.includes('heart')
    || player.labels.includes('leader-b-female')
  )).length);
  const maleLeaderCovered = teams.map(team =>
    team.players.some(player => player.gender === 'M' && (player.labels.includes('leader-a-male') || player.labels.includes('a♂')))
    || team.players.filter(player => player.gender === 'M' && (player.labels.includes('leader-b-male') || player.labels.includes('b♂'))).length >= 2
  );
  const newCounts = teams.map(team => team.players.filter(player => player.isNewPlayer === true).length);
  const youngCounts = teams.map(team => team.players.filter(player => getAgeBand(player) === 'young').length);
  const wiseCounts = teams.map(team => team.players.filter(player => getAgeBand(player) === 'wise').length);
  const niceStats = countNiceToPlayStats(teams);
  const niceToPlayTotal = niceStats.honored + niceStats.broken;
  const niceToPlayHonorRate = niceToPlayTotal > 0 ? niceStats.honored / niceToPlayTotal : 1;

  return {
    playerCount: players.length,
    teamCount: teams.length,
    teamSizeSpread: spread(teamSizes),
    maleSpread: spread(maleCounts),
    femaleSpread: spread(femaleCounts),
    genderSpreadViolations: Math.max(0, spread(maleCounts) - 1) + Math.max(0, spread(femaleCounts) - 1),
    skillSpread: round2(spread(skillAverages)),
    handlerSpread: spread(handlerCounts),
    femaleLeaderTeams: femaleLeaderCounts.filter(count => count > 0).length,
    maleLeaderCoveredTeams: maleLeaderCovered.filter(Boolean).length,
    niceToPlayHonored: niceStats.honored,
    niceToPlayBroken: niceStats.broken,
    niceToPlayTotal,
    niceToPlayHonorRate: round2(niceToPlayHonorRate),
    niceToPlayTargetMet: niceToPlayTotal === 0 || niceToPlayHonorRate >= NICE_TO_PLAY_TARGET_RATE,
    newPlayerSpread: spread(newCounts),
    youngPlayerSpread: spread(youngCounts),
    wisePlayerSpread: spread(wiseCounts),
    avoidViolations: countAvoidViolations(teams),
    hardGroupViolations: countHardGroupViolations(teams, hardGroups),
  };
}

function scoreTeams(teams: DraftTeam[], players: DraftPlayer[], hardGroups: HardGroup[]): number {
  const metrics = buildDraftMetrics(teams, players, hardGroups);
  const femaleLeaderGap = teams.length - metrics.femaleLeaderTeams;
  const maleLeaderGap = teams.length - metrics.maleLeaderCoveredTeams;
  const allPlayersAssigned = teams.reduce((sum, team) => sum + team.players.length, 0) === players.length;
  const finalGenderSpreadPenalty = allPlayersAssigned ? metrics.genderSpreadViolations * 5_000_000 : 0;
  const niceTargetShortfall = Math.max(0, Math.ceil(metrics.niceToPlayTotal * NICE_TO_PLAY_TARGET_RATE) - metrics.niceToPlayHonored);
  const finalNiceTargetPenalty = allPlayersAssigned ? niceTargetShortfall * 250_000 : 0;

  return (
    metrics.avoidViolations * 10_000_000
    + metrics.hardGroupViolations * 10_000_000
    + finalGenderSpreadPenalty
    + metrics.teamSizeSpread * 1_000_000
    + (metrics.maleSpread + metrics.femaleSpread) * 100_000
    + (femaleLeaderGap + maleLeaderGap) * 1_500_000
    + finalNiceTargetPenalty
    + metrics.skillSpread * 1_000
    + metrics.handlerSpread * 500
    + metrics.niceToPlayBroken * 5_000
    + metrics.newPlayerSpread * 10
    + (metrics.youngPlayerSpread + metrics.wisePlayerSpread) * 5
  );
}

function countNiceToPlayStats(teams: DraftTeam[]): { honored: number; broken: number } {
  let honored = 0;
  let broken = 0;
  const seenPairs = new Set<string>();

  for (const team of teams) {
    for (const player of team.players) {
      for (const requestedName of player.niceToPlayRequests) {
        const pairKey = buildPairKey(player.name, requestedName);
        if (seenPairs.has(pairKey)) {
          continue;
        }
        seenPairs.add(pairKey);

        const requestedTeam = teams.find(candidate => candidate.players.some(candidatePlayer => namesMatch(candidatePlayer.name, requestedName)));
        if (!requestedTeam) {
          continue;
        }
        if (requestedTeam.id === team.id) {
          honored += 1;
        } else {
          broken += 1;
        }
      }
    }
  }

  return { honored, broken };
}

function countAvoidViolations(teams: DraftTeam[]): number {
  let violations = 0;
  for (const team of teams) {
    for (const player of team.players) {
      violations += player.avoidRequests.filter(avoidName =>
        team.players.some(candidate => candidate.name !== player.name && namesMatch(candidate.name, avoidName))
      ).length;
    }
  }
  return violations;
}

function countHardGroupViolations(teams: DraftTeam[], hardGroups: HardGroup[]): number {
  let violations = 0;
  for (const group of hardGroups) {
    const teamIds = new Set(
      group.playerNames.map(name => teams.find(team => team.players.some(player => player.name === name))?.id)
    );
    if (teamIds.size !== 1 || teamIds.has(undefined)) {
      violations += 1;
    }
  }
  return violations;
}

function unitCreatesAvoidConflict(incoming: DraftPlayer[], existing: DraftPlayer[]): boolean {
  for (const player of incoming) {
    if (existing.some(candidate => player.avoidRequests.some(avoidName => namesMatch(avoidName, candidate.name)))) {
      return true;
    }
  }

  for (const player of existing) {
    if (incoming.some(candidate => player.avoidRequests.some(avoidName => namesMatch(avoidName, candidate.name)))) {
      return true;
    }
  }

  return false;
}

function createEmptyTeams(teamCount: number, targets: TeamTargets[] = []): TargetedDraftTeam[] {
  return Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    players: [],
    targets: targets[index],
  }));
}

function getString(row: WorkbookRow, candidates: string[]): string {
  for (const candidate of candidates) {
    const key = Object.keys(row).find(header => header.trim().toLowerCase() === candidate.trim().toLowerCase());
    if (key) {
      return String(row[key] ?? '').trim();
    }
  }

  return '';
}

function getNumber(row: WorkbookRow, candidates: string[]): number {
  return Number.parseFloat(getString(row, candidates));
}

function getDraftSkillRating(row: WorkbookRow): number {
  const explicitSkillRating = getNumber(row, ['Self Rank', 'Skill Rating', 'Skill']);
  if (Number.isFinite(explicitSkillRating)) {
    return explicitSkillRating;
  }

  const registrationSkillRating = getRegistrationSelfRank(row);
  if (Number.isFinite(registrationSkillRating)) {
    return registrationSkillRating;
  }

  return getNumber(row, ['Skill Level']);
}

function getRegistrationSelfRank(row: WorkbookRow): number {
  const components = [
    { columns: ['Skill Level'], max: 10 },
    { columns: ['Speed'], max: 5 },
    { columns: ['Throwing'], max: 7 },
    { columns: ['Defence', 'Defense'], max: 5 },
    { columns: ['Handling'], max: 5 },
    { columns: ['Offense', 'Offence'], max: 5 },
    { columns: ['Division Level'], max: 6 },
  ];

  const normalizedScores = components.map(component => {
    const rawValue = getNumber(row, component.columns);
    return Number.isFinite(rawValue) ? (rawValue / component.max) * 10 : null;
  });

  if (normalizedScores.some(score => score === null)) {
    return Number.NaN;
  }

  const scores = normalizedScores.filter((score): score is number => score !== null);
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
}

function getOptionalNumber(row: WorkbookRow, candidates: string[]): number | null {
  const value = Number.parseFloat(getString(row, candidates));
  return Number.isFinite(value) ? value : null;
}

function getOptionalInteger(row: WorkbookRow, candidates: string[]): number | undefined {
  const value = Number.parseInt(getString(row, candidates), 10);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeGender(value: string): Gender {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'm' || normalized === 'male') {
    return 'M';
  }
  if (normalized === 'f' || normalized === 'female') {
    return 'F';
  }
  return 'Other';
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ['yes', 'y', 'true', '1', 'handler', 'x'].includes(normalized);
}

function parseHandlingAsHandler(value: string): boolean {
  const handlingRating = Number.parseFloat(value);
  return Number.isFinite(handlingRating) && handlingRating >= 4;
}

function isCaptainLeaderB(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[’]/g, "'");
  return normalized.includes("i don't mind")
    || normalized.includes('i do not mind')
    || normalized.includes("i'd love")
    || normalized.includes('i would love')
    || normalized.includes('love to be a captain');
}

function getLeaderBLabel(gender: Gender): string {
  if (gender === 'M') {
    return 'leader-b-male';
  }
  if (gender === 'F') {
    return 'leader-b-female';
  }
  return 'leader-b';
}

function parseNewPlayer(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (['new', 'yes', 'y', 'true', '1'].includes(normalized)) {
    return true;
  }
  if (['returning', 'no', 'n', 'false', '0'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseLabels(value: string): string[] {
  return value
    .split(/[,;]/)
    .map(label => label.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean);
}

function normalizeLeaderLabels(labels: string[], gender: Gender): string[] {
  if (gender !== 'F') {
    return uniqueRaw(labels);
  }

  const hasFemaleLeaderA = labels.includes('leader-a-female') || labels.includes('heart');
  return uniqueRaw(labels).filter(label => !(hasFemaleLeaderA && label === 'leader-b-female'));
}

function uniqueRaw(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getEffectiveSkill(player: DraftPlayer): number {
  return player.execSkillRating ?? player.skillRating;
}

function getAgeBand(player: DraftPlayer): 'young' | 'wise' | 'standard' | 'missing' {
  if (player.age === undefined) {
    return 'missing';
  }
  if (player.age <= YOUNG_PLAYER_MAX_AGE) {
    return 'young';
  }
  if (player.age >= WISE_PLAYER_MIN_AGE) {
    return 'wise';
  }
  return 'standard';
}

function countLeaders(players: DraftPlayer[]): number {
  return players.filter(player => player.labels.some(isLeaderLabel)).length;
}

function isLeaderLabel(label: string): boolean {
  return [
    'heart',
    'leader-a-female',
    'leader-a-male',
    'leader-b-male',
    'leader-b-female',
    'leader-b',
    'a♂',
    'b♂',
  ].includes(label);
}

function findPlayer(players: DraftPlayer[], name: string): DraftPlayer | undefined {
  return players.find(player => namesMatch(player.name, name));
}

function namesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return normalizedLeft === normalizedRight;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function union(parent: Map<string, string>, left: string, right: string): void {
  parent.set(find(parent, right), find(parent, left));
}

function find(parent: Map<string, string>, value: string): string {
  const current = parent.get(value) ?? value;
  if (current === value) {
    return current;
  }

  const root = find(parent, current);
  parent.set(value, root);
  return root;
}

function addSource(sourceByRoot: Map<string, Set<HardGroup['source']>>, root: string, source: HardGroup['source']): void {
  sourceByRoot.set(root, new Set([...(sourceByRoot.get(root) ?? []), source]));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function spread(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.max(...values) - Math.min(...values);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = normalizeName(value);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  let state = seed;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function rotateUnits<T>(items: T[], offset: number): T[] {
  if (items.length === 0) {
    return [];
  }

  const normalizedOffset = offset % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = normalizeCliKey(arg.slice(2));
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function normalizeCliKey(key: string): keyof CliOptions {
  const normalized = key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return normalized as keyof CliOptions;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const teamCount = Number.parseInt(options.teamCount ?? '', 10);
  const maxTeamSize = options.maxTeamSize ? Number.parseInt(options.maxTeamSize, 10) : undefined;
  const variationCount = options.variationCount ? Number.parseInt(options.variationCount, 10) : undefined;
  const draftSeeds = options.draftSeeds
    ? options.draftSeeds.split(',').map(seed => Number.parseInt(seed.trim(), 10)).filter(Number.isInteger)
    : undefined;

  if (!options.workbook || !Number.isInteger(teamCount) || !options.season || !options.outDir) {
    console.error('Usage: pnpm tsx scripts/build-season-teams.ts --workbook <xlsx> --team-count <n> --season <name> --out-dir <dir> [--sheet "Roster Self Rank"] [--variation-count <n>] [--draft-seeds 2,3,4,5]');
    process.exitCode = 1;
    return;
  }

  const output = await writeDraftOutputs({
    workbookPath: options.workbook,
    sheetName: options.sheet ?? 'Roster Self Rank',
    teamCount,
    seasonName: options.season,
    outDir: options.outDir,
    maxTeamSize,
    variationCount,
    draftSeeds,
  });

  console.log(`Roster CSV: ${output.rosterPath}`);
  if (output.variations.length > 1) {
    for (const [index, variation] of output.variations.entries()) {
      console.log(`Variation ${index + 1} teams CSV: ${variation.teamsPath}`);
      console.log(`Variation ${index + 1} validation report: ${variation.reportPath}`);
    }
    console.log(`Variation summary: ${output.summaryPath}`);
  } else {
    console.log(`Teams CSV: ${output.teamsPath}`);
    console.log(`Validation report: ${output.reportPath}`);
  }
  console.log(`Request mapping audit: ${output.requestMappingPath}`);
  console.log(`Hard rules: ${output.variations.every(variation => variation.result.hardRulesPassed) ? 'PASS' : 'FAIL'}`);
}

const invokedPath = pathToFileURL(process.argv[1] ?? '').href;
if (import.meta.url === invokedPath) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
