import XLSX from 'xlsx';
import { loadLocalEnv, resolveWorkspaceRecord } from './src/server/workspaces/firebaseWorkspaceAccess.ts';
import { buildWorkspaceWithGeneratedDrafts } from './src/server/workspaces/workspaceDraftBuilder.ts';

const USER_ID = '81MVUsmm6mYkyHUwA6bvL0b4opU2';
const WORKSPACE_NAME = 'Spring league 134';
const RANKINGS_PATH = 'Female Spring rankings.ods';

function normalizeLetters(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first: parts.slice(0, -1).join(' ') || parts[0] || '',
    last: parts.at(-1) || '',
  };
}

function loadRankings() {
  const workbook = XLSX.readFile(RANKINGS_PATH, { cellText: true, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, raw: false, defval: '' });
  const rankings = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const first = String(row[0] ?? '').trim();
    const last = String(row[1] ?? '').trim();
    const avgRaw = String(row[11] ?? '').trim();
    if (!first && !last) continue;
    const avg = Number(avgRaw);
    if (!Number.isFinite(avg)) continue;
    rankings.set(`${first} ${last}`.trim(), avg);
  }
  return rankings;
}

function matchRankingName(sourceName: string, targetNames: string[]): string | null {
  const aliasMap = new Map<string, string>([
    ['Steph Vecchiarelli', 'Stephanie Vecchiarelli'],
  ]);

  if (aliasMap.has(sourceName)) {
    return aliasMap.get(sourceName)!;
  }

  const normalizedSource = normalizeLetters(sourceName);
  const exact = targetNames.find(name => normalizeLetters(name) === normalizedSource);
  if (exact) return exact;

  const source = splitName(sourceName);
  const normalizedSourceFirst = normalizeLetters(source.first);
  const normalizedSourceLast = normalizeLetters(source.last);
  const prefixMatches = targetNames.filter(name => {
    const target = splitName(name);
    const normalizedTargetFirst = normalizeLetters(target.first);
    const normalizedTargetLast = normalizeLetters(target.last);
    return normalizedSourceLast
      && normalizedSourceLast === normalizedTargetLast
      && (normalizedTargetFirst.startsWith(normalizedSourceFirst) || normalizedSourceFirst.startsWith(normalizedTargetFirst));
  });

  return prefixMatches.length === 1 ? prefixMatches[0]! : null;
}

await loadLocalEnv();
const rankings = loadRankings();
const record = await resolveWorkspaceRecord({ workspaceName: WORKSPACE_NAME, userId: USER_ID });
const femaleNames = record.workspace.players.filter(p => p.gender === 'F').map(p => p.name);
const unmatchedSheet = [] as string[];
let changed = 0;
for (const [sheetName, rating] of rankings.entries()) {
  const matched = matchRankingName(sheetName, femaleNames);
  if (!matched) {
    unmatchedSheet.push(sheetName);
    continue;
  }
  const player = record.workspace.players.find(p => p.name === matched)!;
  if (player.execSkillRating !== rating) changed += 1;
  player.execSkillRating = rating;
}
const now = Date.now();
record.workspace.execRatingHistory = Object.fromEntries(
  record.workspace.players
    .filter(player => player.execSkillRating !== null)
    .map(player => [player.name.trim().toLowerCase(), { rating: player.execSkillRating!, updatedAt: now }])
);
const playersById = new Map(record.workspace.players.map(player => [player.id, player]));
record.workspace.playerGroups = (record.workspace.playerGroups ?? []).map(group => ({
  ...group,
  playerIds: [...group.playerIds],
  players: group.playerIds.map(id => playersById.get(id)).filter(Boolean),
}));
const result = await buildWorkspaceWithGeneratedDrafts(record.workspace, { draftCount: 3 });
console.log(JSON.stringify({
  changed,
  unmatchedSheet,
  targetTeams: result.workspace.config.targetTeams,
  generatedDrafts: result.generatedDrafts.map(d => ({
    id: d.iteration.id,
    name: d.iteration.name,
    score: d.insights.score.total,
    skillSpread: d.insights.skillSpread,
    maleCounts: d.iteration.teams.map(t => t.genderBreakdown.M),
    femaleCounts: d.iteration.teams.map(t => t.genderBreakdown.F),
    unassigned: d.iteration.unassignedPlayers.length,
  })),
  activeDraft: result.activeDraft.iteration.name,
}, null, 2));
