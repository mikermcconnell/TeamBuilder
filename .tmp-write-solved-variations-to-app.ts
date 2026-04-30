import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';
import { loadLocalEnv, resolveWorkspaceRecord, saveWorkspaceRecord, type LoadedWorkspaceRecord } from './src/server/workspaces/firebaseWorkspaceAccess.ts';
import { buildGenerationResult } from './src/utils/teamGenerator.ts';
import type { Player, PlayerGroup, SavedWorkspace, Team, TeamIteration } from './src/types/index.ts';

const USER_ID = '81MVUsmm6mYkyHUwA6bvL0b4opU2';
const WORKSPACE_NAME = 'Spring league 134';
const RANKINGS_PATH = 'Female Spring rankings.ods';
const SOLUTIONS_PATH = '.tmp-solved-variations.json';
const TEAM_NAMES = ['Comets', 'Wolves', 'Storm', 'Foxes', 'Falcons', 'Waves', 'Blaze', 'Rockets', 'Chargers', 'Titans'];
const ACTIVE_VARIATION_INDEX = 2; // Variation 3

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

function cleanUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cleanUndefinedDeep(item)).filter(item => item !== undefined) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, inner]) => [key, cleanUndefinedDeep(inner)])
        .filter(([, inner]) => inner !== undefined)
    ) as T;
  }
  return value;
}

function clonePlayer(player: Player): Player {
  return {
    ...player,
    profile: player.profile ? { ...player.profile } : undefined,
    teammateRequests: [...(player.teammateRequests ?? [])],
    avoidRequests: [...(player.avoidRequests ?? [])],
    teammateRequestsParsed: player.teammateRequestsParsed?.map(request => ({ ...request })),
    unfulfilledRequests: player.unfulfilledRequests?.map(request => ({ ...request })),
  };
}

function cloneTeam(team: Team): Team {
  return {
    ...team,
    players: team.players.map(clonePlayer),
    genderBreakdown: { ...team.genderBreakdown },
  };
}

function clonePlayerGroups(groups: PlayerGroup[], players: Player[]): PlayerGroup[] {
  const playersById = new Map(players.map(player => [player.id, player]));
  return (groups ?? []).map(group => ({
    ...group,
    playerIds: [...group.playerIds],
    players: group.playerIds.map(id => playersById.get(id)).filter((player): player is Player => Boolean(player)),
  }));
}

function getEffectiveSkill(player: Player): number {
  return player.execSkillRating !== null && player.execSkillRating !== undefined ? player.execSkillRating : player.skillRating;
}

function updateTeamStats(team: Team) {
  const skillValues = team.players.map(getEffectiveSkill).filter((value): value is number => Number.isFinite(value));
  team.averageSkill = skillValues.length ? skillValues.reduce((sum, value) => sum + value, 0) / skillValues.length : 0;
  team.genderBreakdown = {
    M: team.players.filter(player => player.gender === 'M').length,
    F: team.players.filter(player => player.gender === 'F').length,
    Other: team.players.filter(player => player.gender !== 'M' && player.gender !== 'F').length,
  };
  team.handlerCount = team.players.filter(player => Boolean((player as Player & { isHandler?: boolean }).isHandler)).length;
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

  if (aliasMap.has(sourceName)) return aliasMap.get(sourceName)!;

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

function applyFemaleRankings(workspace: SavedWorkspace, rankings: Map<string, number>) {
  const femaleNames = workspace.players.filter(player => player.gender === 'F').map(player => player.name);
  const unmatchedSheetNames: string[] = [];
  const unmatchedWorkspaceFemales = new Set(femaleNames);
  const changedPlayers: Array<{ name: string; from: number | null; to: number }> = [];

  for (const [sheetName, rating] of rankings.entries()) {
    const matchedName = matchRankingName(sheetName, femaleNames);
    if (!matchedName) {
      unmatchedSheetNames.push(sheetName);
      continue;
    }
    unmatchedWorkspaceFemales.delete(matchedName);
    const player = workspace.players.find(candidate => candidate.name === matchedName);
    if (!player) {
      unmatchedSheetNames.push(sheetName);
      continue;
    }
    if (player.execSkillRating !== rating) {
      changedPlayers.push({ name: player.name, from: player.execSkillRating, to: rating });
    }
    player.execSkillRating = rating;
  }

  if (unmatchedWorkspaceFemales.size > 0) {
    throw new Error(`Unmatched female workspace players: ${[...unmatchedWorkspaceFemales].join(', ')}`);
  }

  const now = Date.now();
  workspace.execRatingHistory = Object.fromEntries(
    workspace.players
      .filter(player => player.execSkillRating !== null && player.execSkillRating !== undefined)
      .map(player => [player.name.trim().toLowerCase(), { rating: player.execSkillRating!, updatedAt: now }])
  );
  workspace.playerGroups = clonePlayerGroups(workspace.playerGroups ?? [], workspace.players);

  return { unmatchedSheetNames, changedPlayers };
}

function computeSpread(iteration: TeamIteration) {
  const males = iteration.teams.map(team => team.genderBreakdown.M);
  const females = iteration.teams.map(team => team.genderBreakdown.F);
  return {
    maleSpread: Math.max(...males) - Math.min(...males),
    femaleSpread: Math.max(...females) - Math.min(...females),
    males,
    females,
  };
}

function verifyGroupsStayTogether(iteration: TeamIteration, groups: PlayerGroup[]) {
  const teamByPlayerId = new Map<string, string>();
  iteration.teams.forEach(team => team.players.forEach(player => teamByPlayerId.set(player.id, team.id)));
  return groups
    .filter(group => group.playerIds.length > 1)
    .filter(group => new Set(group.playerIds.map(id => teamByPlayerId.get(id)).filter(Boolean)).size > 1)
    .map(group => group.label || group.id);
}

async function backupWorkspace(record: LoadedWorkspaceRecord) {
  const slug = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(`backup-${record.workspace.id}-before-writing-solved-variations-${slug}.json`);
  await fs.writeFile(backupPath, JSON.stringify(record.workspace, null, 2), 'utf8');
  return backupPath;
}

async function main() {
  await loadLocalEnv();
  const loaded = await resolveWorkspaceRecord({ workspaceName: WORKSPACE_NAME, userId: USER_ID });
  const backupPath = await backupWorkspace(loaded);
  const workspace = structuredClone(loaded.workspace) as SavedWorkspace;

  const rankings = loadRankings();
  const rankingResult = applyFemaleRankings(workspace, rankings);

  const solved = JSON.parse(await fs.readFile(SOLUTIONS_PATH, 'utf8')) as {
    solutions: Array<{
      name: string;
      moved: number;
      team_player_ids: string[][];
      male_counts: number[];
      female_counts: number[];
      other_counts: number[];
      team_sizes: number[];
      avg_skills: number[];
      avg_spread: number;
    }>;
  };

  if (solved.solutions.length !== 3) throw new Error(`Expected 3 solutions, found ${solved.solutions.length}`);
  if ((workspace.teams?.length ?? 0) !== 10) throw new Error(`Expected 10 workspace teams, found ${workspace.teams?.length ?? 0}`);

  const teamTemplates = workspace.teams.map((team, index) => ({
    ...team,
    name: TEAM_NAMES[index] ?? `Team ${index + 1}`,
    isNameManuallySet: true,
    isNameEditable: true,
  }));

  const playersById = new Map(workspace.players.map(player => [player.id, player]));
  const nowIso = new Date().toISOString();

  function buildIteration(solution: (typeof solved.solutions)[number], index: number): TeamIteration {
    const teams: Team[] = teamTemplates.map(template => ({
      ...template,
      players: [],
      averageSkill: 0,
      genderBreakdown: { M: 0, F: 0, Other: 0 },
      handlerCount: 0,
      isNameManuallySet: true,
      isNameEditable: true,
    }));

    solution.team_player_ids.forEach((teamPlayerIds, teamIndex) => {
      const team = teams[teamIndex]!;
      for (const playerId of teamPlayerIds) {
        const source = playersById.get(playerId);
        if (!source) throw new Error(`Player ${playerId} not found in workspace`);
        const player = clonePlayer(source);
        player.teamId = team.id;
        team.players.push(player);
      }
      updateTeamStats(team);
    });

    const allPlayersForStats = teams.flatMap(team => team.players.map(player => clonePlayer(player)));
    const statSourcePlayers = workspace.players.map(player => {
      const assigned = allPlayersForStats.find(candidate => candidate.id === player.id);
      return assigned ? clonePlayer(assigned) : { ...clonePlayer(player), teamId: undefined };
    });
    const groupsForStats = clonePlayerGroups(workspace.playerGroups ?? [], statSourcePlayers);
    const stats = buildGenerationResult(statSourcePlayers, teams.map(cloneTeam), [], workspace.config, groupsForStats, Date.now()).stats;

    return {
      id: `solved-variation-${index + 1}`,
      name: `Balanced Variation ${index + 1}`,
      type: 'generated',
      status: 'ready',
      generationSource: 'generated',
      teams,
      unassignedPlayers: [],
      stats,
      createdAt: nowIso,
    };
  }

  const iterations = solved.solutions.map(buildIteration);
  const activeIteration = iterations[ACTIVE_VARIATION_INDEX]!;

  const activePlayersById = new Map(activeIteration.teams.flatMap(team => team.players.map(player => [player.id, player] as const)));
  workspace.players = workspace.players.map(player => {
    const assigned = activePlayersById.get(player.id);
    const nextPlayer = clonePlayer(player);
    nextPlayer.teamId = assigned?.teamId;
    if (assigned) nextPlayer.execSkillRating = assigned.execSkillRating;
    return nextPlayer;
  });
  workspace.playerGroups = clonePlayerGroups(workspace.playerGroups ?? [], workspace.players);
  workspace.teams = activeIteration.teams.map(cloneTeam);
  workspace.unassignedPlayers = [];
  workspace.stats = activeIteration.stats;
  workspace.teamIterations = iterations.map(iteration => ({
    ...iteration,
    teams: iteration.teams.map(cloneTeam),
    unassignedPlayers: [],
    stats: iteration.stats ? { ...iteration.stats } : undefined,
  }));
  workspace.activeTeamIterationId = activeIteration.id;
  workspace.updatedAt = nowIso;
  workspace.revision = (loaded.workspace.revision ?? 0) + 1;

  const savePayload = cleanUndefinedDeep(workspace);
  await saveWorkspaceRecord(savePayload, {
    expectedRevision: loaded.workspace.revision,
    expectedUpdateTime: loaded.updateTime,
  });

  const fresh = await resolveWorkspaceRecord({ workspaceId: workspace.id });

  const verifyIteration = (iterationId: string) => {
    const iteration = (fresh.workspace.teamIterations ?? []).find(candidate => candidate.id === iterationId);
    if (!iteration) throw new Error(`Iteration ${iterationId} missing after save`);
    const spread = computeSpread(iteration);
    const splitGroups = verifyGroupsStayTogether(iteration, fresh.workspace.playerGroups ?? []);
    return {
      name: iteration.name,
      teams: iteration.teams.length,
      unassigned: iteration.unassignedPlayers.length,
      maleSpread: spread.maleSpread,
      femaleSpread: spread.femaleSpread,
      splitGroups,
      names: iteration.teams.map(team => team.name),
    };
  };

  const iterationChecks = iterations.map(iteration => verifyIteration(iteration.id));
  const activeNames = fresh.workspace.teams.map(team => team.name);
  const femaleChecks = ['Brianna Hall', 'Christy Doolittle', 'Emilie Farr', 'Sarah McLean'].map(name => {
    const player = fresh.workspace.players.find(candidate => candidate.name === name);
    return { name, rating: player?.execSkillRating ?? null };
  });

  console.log(JSON.stringify({
    backupPath,
    workspaceId: fresh.workspace.id,
    revisionBefore: loaded.workspace.revision,
    revisionAfter: fresh.workspace.revision,
    activeTeamIterationId: fresh.workspace.activeTeamIterationId,
    activeTeamNames: activeNames,
    teamIterations: iterationChecks,
    femaleExecChecks: femaleChecks,
    unmatchedSheetNames: rankingResult.unmatchedSheetNames,
    changedPlayers: rankingResult.changedPlayers,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
