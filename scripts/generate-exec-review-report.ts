import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  type DraftPlayer,
  type SeasonDraftResult,
  buildRequestMappingAudit,
  buildSeasonDraftFromRows,
  readWorkbookRows,
  validateWorkbookRowsForDrafting,
} from './build-season-teams';

const DEFAULT_WORKBOOK = 'output/summer-2026/pass-9-leader-variations/summer-outdoor-2026-july-3-draft-source.csv';
const DEFAULT_SHEET = 'Roster Self Rank';
const DEFAULT_OUT_DIR = 'output/summer-2026/pass-9-leader-variations';
const DEFAULT_SRC_DATA_PATH = 'src/data/summer2026ExecReview.ts';
const DEFAULT_JSON_PATH = 'output/summer-2026/pass-9-leader-variations/summer-outdoor-2026-july-3-exec-review.json';
const DEFAULT_MARKDOWN_PATH = 'output/summer-2026/pass-9-leader-variations/summer-outdoor-2026-july-3-exec-review.md';
const DEFAULT_PUBLIC_JSON_PATH = 'public/reports/summer-outdoor-2026-exec-review.json';
const DEFAULT_PUBLIC_MARKDOWN_PATH = 'public/reports/summer-outdoor-2026-exec-review.md';
const DRAFT_SEEDS = [2, 3, 4, 5];
const VARIATION_LABELS = ['Variation 1', 'Variation 2', 'Variation 3', 'Variation 4'];

type Gender = 'M' | 'F' | 'Other';

interface CliOptions {
  workbook?: string;
  sheet?: string;
  outDir?: string;
  srcDataPath?: string;
  jsonPath?: string;
  markdownPath?: string;
  publicJsonPath?: string;
  publicMarkdownPath?: string;
}

interface ExecReviewPlayer {
  name: string;
  gender: Gender;
  skill: number;
  handler: boolean;
  leaders: string[];
  newReturning: 'new' | 'returning' | 'unknown';
  ageBand: 'young' | 'wise' | 'standard' | 'unknown';
}

interface ExecReviewTeam {
  name: string;
  size: number;
  male: number;
  female: number;
  other: number;
  averageSkill: number;
  femaleAverageSkill: number;
  maleAverageSkill: number;
  handlers: number;
  leaders: string[];
  newPlayers: number;
  returningPlayers: number;
  youngPlayers: number;
  wisePlayers: number;
  mustPlayGroups: string[][];
  niceRequestsHonored: string[];
  roster: ExecReviewPlayer[];
}

interface ExecReviewVariation {
  id: string;
  name: string;
  seed: number;
  summary: {
    hardRulesPassed: boolean;
    teamSizes: number[];
    maleSpread: number;
    femaleSpread: number;
    genderSpreadViolations: number;
    skillSpread: number;
    handlerSpread: number;
    femaleLeaderTeams: number;
    maleLeaderCoveredTeams: number;
    niceHonored: number;
    niceTotal: number;
    niceRate: number;
    niceTargetMet: boolean;
    newPlayerSpread: number;
    youngPlayerSpread: number;
    wisePlayerSpread: number;
  };
  strengths: string[];
  watchItems: string[];
  teams: ExecReviewTeam[];
}

export interface ExecReviewReport {
  seasonName: string;
  generatedAt: string;
  source: {
    workbook: string;
    sheet: string;
    teamCount: number;
    seeds: number[];
  };
  rules: string[];
  roster: {
    totalPlayers: number;
    male: number;
    female: number;
    other: number;
    handlers: number;
    femaleLeaders: number;
    femaleLeaderB: number;
    maleLeaderA: number;
    maleLeaderB: number;
    newPlayers: number;
    returningPlayers: number;
    mutualNicePairs: number;
    ignoredOneWayNiceRequests: number;
  };
  variations: ExecReviewVariation[];
}

export function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()) as keyof CliOptions;
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      continue;
    }
    options[key] = next;
    index += 1;
  }

  return options;
}

export async function buildAndWriteExecReviewReport(options: CliOptions = {}) {
  const workbook = options.workbook ?? DEFAULT_WORKBOOK;
  const sheet = options.sheet ?? DEFAULT_SHEET;
  const outDir = options.outDir ?? DEFAULT_OUT_DIR;
  const srcDataPath = options.srcDataPath ?? DEFAULT_SRC_DATA_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const markdownPath = options.markdownPath ?? DEFAULT_MARKDOWN_PATH;
  const publicJsonPath = options.publicJsonPath ?? DEFAULT_PUBLIC_JSON_PATH;
  const publicMarkdownPath = options.publicMarkdownPath ?? DEFAULT_PUBLIC_MARKDOWN_PATH;

  const rows = readWorkbookRows(workbook, sheet);
  validateWorkbookRowsForDrafting(rows);

  const results = DRAFT_SEEDS.map((seed, index) => buildSeasonDraftFromRows({
    rows,
    teamCount: 8,
    seasonName: 'Summer Outdoor 2026',
    draftSeed: seed,
    variationName: VARIATION_LABELS[index] ?? `Variation ${index + 1}`,
  }));
  const report = buildExecReviewReport({
    workbook,
    sheet,
    seeds: DRAFT_SEEDS,
    results,
  });
  const markdown = buildExecReviewMarkdown(report);

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.dirname(srcDataPath), { recursive: true });
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.mkdir(path.dirname(publicJsonPath), { recursive: true });
  await fs.mkdir(path.dirname(publicMarkdownPath), { recursive: true });

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, markdown, 'utf8');
  await fs.writeFile(publicJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(publicMarkdownPath, markdown, 'utf8');
  await fs.writeFile(
    srcDataPath,
    [
      '/* Auto-generated by scripts/generate-exec-review-report.ts. */',
      `export const summer2026ExecReview = ${JSON.stringify(report, null, 2)} as const;`,
      '',
    ].join('\n'),
    'utf8',
  );

  return {
    report,
    jsonPath,
    markdownPath,
    publicJsonPath,
    publicMarkdownPath,
    srcDataPath,
  };
}

export function buildExecReviewReport(input: {
  workbook: string;
  sheet: string;
  seeds: number[];
  results: SeasonDraftResult[];
}): ExecReviewReport {
  const firstResult = input.results[0];
  if (!firstResult) {
    throw new Error('At least one draft result is required.');
  }

  const requestAudit = buildRequestMappingAudit(firstResult.players, firstResult.hardGroups);
  const rosterCounts = buildRosterCounts(firstResult.players);
  const variations = input.results.map((result, index) =>
    buildExecReviewVariation(result, input.seeds[index] ?? index + 1, requestAudit.niceToPlayMappings.map(mapping => [mapping.playerName, mapping.requestedName]))
  );
  return {
    seasonName: firstResult.seasonName,
    generatedAt: new Date().toISOString(),
    source: {
      workbook: input.workbook,
      sheet: input.sheet,
      teamCount: firstResult.metrics.teamCount,
      seeds: input.seeds,
    },
    rules: [
      'Keep must-play groups together.',
      'Keep avoid requests apart.',
      'Keep male and female counts as even as possible.',
      'Keep mutual nice-to-have requests together when possible.',
      'Spread female and male leaders.',
      'Balance skill and handlers.',
    ],
    roster: {
      ...rosterCounts,
      mutualNicePairs: requestAudit.niceToPlayMappings.length,
      ignoredOneWayNiceRequests: requestAudit.ignoredOneWayNiceRequests.length,
    },
    variations,
  };
}

export function buildExecReviewMarkdown(report: ExecReviewReport): string {
  const lines = [
    `# ${report.seasonName} Exec Draft Review`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Executive summary',
    '',
    `- Players: ${report.roster.totalPlayers} (${report.roster.male}M / ${report.roster.female}F / ${report.roster.other}O)`,
    `- Teams: ${report.source.teamCount}`,
    `- Nice-to-have requests: ${report.roster.mutualNicePairs}`,
    `- Ignored one-way nice requests: ${report.roster.ignoredOneWayNiceRequests}`,
    '',
    '## Variation comparison',
    '',
    '| Variation | Must-play groups | Nice requests honoured | Gender balance | Skill spread | Handler spread | Female leaders | Male leaders |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...report.variations.map(variation => [
      variation.name,
      variation.summary.hardRulesPassed ? 'Kept' : 'Check',
      `${variation.summary.niceHonored}/${variation.summary.niceTotal} (${Math.round(variation.summary.niceRate * 100)}%)`,
      `${variation.summary.maleSpread}M / ${variation.summary.femaleSpread}F spread`,
      variation.summary.skillSpread.toFixed(2),
      String(variation.summary.handlerSpread),
      `${variation.summary.femaleLeaderTeams}/8 teams`,
      `${variation.summary.maleLeaderCoveredTeams}/8 teams`,
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |')),
    '',
  ];

  for (const variation of report.variations) {
    lines.push(`## ${variation.name}`, '');
    lines.push(
      `- Must-play groups: ${variation.summary.hardRulesPassed ? 'Kept together' : 'Needs review'}`,
      `- Nice-to-have requests honoured: ${variation.summary.niceHonored}/${variation.summary.niceTotal} (${Math.round(variation.summary.niceRate * 100)}%)`,
      `- Female leaders: ${variation.summary.femaleLeaderTeams}/8 teams`,
      `- Male leaders: ${variation.summary.maleLeaderCoveredTeams}/8 teams`,
      `- Skill spread: ${variation.summary.skillSpread.toFixed(2)}`,
      `- Handler spread: ${variation.summary.handlerSpread}`,
      '',
      '### Player rows',
      '',
      '| Team | Player | Gender | Skill | Handler | Leader | Status | Age |',
      '|---|---|---:|---:|---:|---|---|---|',
    );

    for (const team of variation.teams) {
      for (const player of team.roster) {
        lines.push([
          team.name,
          player.name,
          player.gender,
          player.skill.toFixed(1),
          player.handler ? 'Yes' : 'No',
          player.leaders.length > 0 ? player.leaders.join(', ') : '',
          player.newReturning,
          player.ageBand,
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
      }
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function buildExecReviewVariation(
  result: SeasonDraftResult,
  seed: number,
  nicePairs: string[][],
): ExecReviewVariation {
  const id = `variation-${seed}`;
  const teams = result.teams.map(team => {
    const niceRequestsHonored = nicePairs
      .filter(([left, right]) =>
        left
        && right
        && team.players.some(player => namesEqual(player.name, left))
        && team.players.some(player => namesEqual(player.name, right))
      )
      .map(([left, right]) => `${left} <-> ${right}`);
    const mustPlayGroups = result.hardGroups
      .filter(group => group.playerNames.every(name => team.players.some(player => namesEqual(player.name, name))))
      .map(group => group.playerNames);

    const femalePlayers = team.players.filter(player => player.gender === 'F');
    const malePlayers = team.players.filter(player => player.gender === 'M');

    return {
      name: team.name,
      size: team.players.length,
      male: malePlayers.length,
      female: femalePlayers.length,
      other: team.players.filter(player => player.gender === 'Other').length,
      averageSkill: round1(average(team.players.map(getEffectiveSkill))),
      femaleAverageSkill: round1(average(femalePlayers.map(getEffectiveSkill))),
      maleAverageSkill: round1(average(malePlayers.map(getEffectiveSkill))),
      handlers: team.players.filter(player => player.isHandler).length,
      leaders: team.players.flatMap(formatTeamLeaderLabels),
      newPlayers: team.players.filter(player => player.isNewPlayer === true).length,
      returningPlayers: team.players.filter(player => player.isNewPlayer === false).length,
      youngPlayers: team.players.filter(player => player.age !== undefined && player.age <= 21).length,
      wisePlayers: team.players.filter(player => player.age !== undefined && player.age >= 44).length,
      mustPlayGroups,
      niceRequestsHonored,
      roster: team.players.map(player => ({
        name: player.name,
        gender: player.gender,
        skill: round1(getEffectiveSkill(player)),
        handler: player.isHandler,
        leaders: formatPlayerLeaderRoles(player),
        newReturning: player.isNewPlayer === true ? 'new' : player.isNewPlayer === false ? 'returning' : 'unknown',
        ageBand: player.age === undefined ? 'unknown' : player.age <= 21 ? 'young' : player.age >= 44 ? 'wise' : 'standard',
      })),
    };
  });
  const summary = {
    hardRulesPassed: result.hardRulesPassed,
    teamSizes: result.teams.map(team => team.players.length),
    maleSpread: result.metrics.maleSpread,
    femaleSpread: result.metrics.femaleSpread,
    genderSpreadViolations: result.metrics.genderSpreadViolations,
    skillSpread: result.metrics.skillSpread,
    handlerSpread: result.metrics.handlerSpread,
    femaleLeaderTeams: result.metrics.femaleLeaderTeams,
    maleLeaderCoveredTeams: result.metrics.maleLeaderCoveredTeams,
    niceHonored: result.metrics.niceToPlayHonored,
    niceTotal: result.metrics.niceToPlayTotal,
    niceRate: result.metrics.niceToPlayHonorRate,
    niceTargetMet: result.metrics.niceToPlayTargetMet,
    newPlayerSpread: result.metrics.newPlayerSpread,
    youngPlayerSpread: result.metrics.youngPlayerSpread,
    wisePlayerSpread: result.metrics.wisePlayerSpread,
  };

  return {
    id,
    name: result.variationName ?? `Variation ${seed}`,
    seed,
    summary,
    strengths: buildStrengths(summary),
    watchItems: buildWatchItems(summary, teams),
    teams,
  };
}

function buildRosterCounts(players: DraftPlayer[]) {
  return {
    totalPlayers: players.length,
    male: players.filter(player => player.gender === 'M').length,
    female: players.filter(player => player.gender === 'F').length,
    other: players.filter(player => player.gender === 'Other').length,
    handlers: players.filter(player => player.isHandler).length,
    femaleLeaders: players.filter(player => player.gender === 'F' && hasFemaleLeaderLabel(player)).length,
    femaleLeaderB: players.filter(player => player.gender === 'F' && player.labels.includes('leader-b-female')).length,
    maleLeaderA: players.filter(player => player.labels.includes('leader-a-male')).length,
    maleLeaderB: players.filter(player => player.labels.includes('leader-b-male')).length,
    newPlayers: players.filter(player => player.isNewPlayer === true).length,
    returningPlayers: players.filter(player => player.isNewPlayer === false).length,
  };
}

function buildStrengths(summary: ExecReviewVariation['summary']): string[] {
  const strengths = [];
  if (summary.hardRulesPassed) {
    strengths.push('Keeps the required groups together.');
  }
  if (summary.niceTargetMet) {
    strengths.push(`Honours ${summary.niceHonored}/${summary.niceTotal} nice-to-have requests.`);
  }
  if (summary.genderSpreadViolations === 0) {
    strengths.push('Keeps gender counts even.');
  }
  if (summary.skillSpread <= 0.8) {
    strengths.push('Strong skill balance.');
  }
  if (summary.handlerSpread <= 2) {
    strengths.push('Strong handler balance.');
  }
  return strengths;
}

function buildWatchItems(summary: ExecReviewVariation['summary'], teams: ExecReviewTeam[]): string[] {
  const watchItems = [];
  const noFemaleLeaderTeams = teams.filter(team => !team.leaders.some(leader => leader.includes('female leader'))).map(team => team.name);
  const noMaleLeaderTeams = teams.filter(team => !team.leaders.some(leader => leader.includes('male leader A') || leader.includes('male leader B'))).map(team => team.name);
  const lowHandlerTeams = teams.filter(team => team.handlers <= 4).map(team => `${team.name} (${team.handlers})`);

  if (!summary.niceTargetMet) {
    watchItems.push('Below the 75% nice-to-have target.');
  }
  if (summary.skillSpread > 1) {
    watchItems.push(`Skill spread is ${summary.skillSpread.toFixed(2)}.`);
  }
  if (noFemaleLeaderTeams.length > 0) {
    watchItems.push(`No female leader: ${noFemaleLeaderTeams.join(', ')}.`);
  }
  if (noMaleLeaderTeams.length > 0) {
    watchItems.push(`No male leader: ${noMaleLeaderTeams.join(', ')}.`);
  }
  if (lowHandlerTeams.length > 0) {
    watchItems.push(`Lowest handler teams: ${lowHandlerTeams.join(', ')}.`);
  }

  return watchItems;
}

function formatTeamLeaderLabels(player: DraftPlayer): string[] {
  const leaders = [];
  if (hasFemaleLeaderLabel(player)) {
    leaders.push(`${player.name} - female leader A`);
  } else if (player.labels.includes('leader-b-female')) {
    leaders.push(`${player.name} - female leader B`);
  }
  if (player.labels.includes('leader-a-male')) {
    leaders.push(`${player.name} - male leader A`);
  }
  if (player.labels.includes('leader-b-male')) {
    leaders.push(`${player.name} - male leader B`);
  }
  return leaders;
}

function formatPlayerLeaderRoles(player: DraftPlayer): string[] {
  const leaders = [];
  if (hasFemaleLeaderLabel(player)) {
    leaders.push('Female leader A');
  } else if (player.labels.includes('leader-b-female')) {
    leaders.push('Female leader B');
  }
  if (player.labels.includes('leader-a-male')) {
    leaders.push('Male leader A');
  }
  if (player.labels.includes('leader-b-male')) {
    leaders.push('Male leader B');
  }
  return leaders;
}

function hasFemaleLeaderLabel(player: DraftPlayer): boolean {
  return player.labels.includes('leader-a-female') || player.labels.includes('heart');
}

function getEffectiveSkill(player: DraftPlayer): number {
  return player.execSkillRating ?? player.skillRating;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function namesEqual(left: string, right: string): boolean {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

async function main() {
  const output = await buildAndWriteExecReviewReport(parseCliOptions(process.argv.slice(2)));
  console.log(`Exec review JSON: ${output.jsonPath}`);
  console.log(`Exec review Markdown: ${output.markdownPath}`);
  console.log(`Website data: ${output.srcDataPath}`);
}

const invokedPath = pathToFileURL(process.argv[1] ?? '').href;
if (import.meta.url === invokedPath) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
