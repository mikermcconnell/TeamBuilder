import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';
import { loadLocalEnv, resolveWorkspaceRecord, saveWorkspaceRecord, type LoadedWorkspaceRecord } from './src/server/workspaces/firebaseWorkspaceAccess.ts';
import { buildWorkspaceWithGeneratedDrafts } from './src/server/workspaces/workspaceDraftBuilder.ts';
import { generateBalancedTeams } from './src/utils/teamGenerator.ts';
import type { Player, PlayerGroup, SavedWorkspace, Team, TeamGenerationStats, TeamIteration } from './src/types/index.ts';

const USER_ID = '81MVUsmm6mYkyHUwA6bvL0b4opU2';
const WORKSPACE_NAME = 'Spring league 134';
const RANKINGS_PATH = 'Female Spring rankings.ods';
const MAX_RETRIES = 3;

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
    players: (team.players ?? []).map(clonePlayer),
    genderBreakdown: {
      M: team.genderBreakdown?.M ?? 0,
      F: team.genderBreakdown?.F ?? 0,
      Other: team.genderBreakdown?.Other ?? 0,
    },
  };
}

function cloneStats(stats?: TeamGenerationStats): TeamGenerationStats | undefined {
  return stats ? { ...stats } : undefined;
}

function clonePlayerGroups(groups: PlayerGroup[], players: Player[]): PlayerGroup[] {
  const playersById = new Map(players.map(player => [player.id, player]));
  return (groups ?? []).map(group => ({
    ...group,
    playerIds: [...group.playerIds],
    players: group.playerIds.map(id => playersById.get(id)).filter((player): player is Player => Boolean(player)),
  }));
}

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
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
    throw new Error(`Some female players in the workspace were not matched to the rankings sheet: ${[...unmatchedWorkspaceFemales].join(', ')}`);
  }

  const now = Date.now();
  workspace.execRatingHistory = Object.fromEntries(
    workspace.players
      .filter(player => player.execSkillRating !== null)
      .map(player => [player.name.trim().toLowerCase(), { rating: player.execSkillRating!, updatedAt: now }])
  );
  workspace.playerGroups = clonePlayerGroups(workspace.playerGroups ?? [], workspace.players);

  return { unmatchedSheetNames, changedPlayers };
}

function computeGenderSpread(iteration: TeamIteration) {
  const maleCounts = iteration.teams.map(team => team.genderBreakdown.M);
  const femaleCounts = iteration.teams.map(team => team.genderBreakdown.F);
  return {
    maleCounts,
    femaleCounts,
    maleSpread: Math.max(...maleCounts) - Math.min(...maleCounts),
    femaleSpread: Math.max(...femaleCounts) - Math.min(...femaleCounts),
  };
}

function verifyGroupsStayTogether(iteration: TeamIteration, groups: PlayerGroup[]) {
  const teamByPlayerId = new Map<string, string>();
  iteration.teams.forEach(team => {
    team.players.forEach(player => {
      teamByPlayerId.set(player.id, team.id);
    });
  });

  return (groups ?? [])
    .filter(group => group.playerIds.length > 1)
    .filter(group => {
      const assignedTeams = new Set(group.playerIds.map(id => teamByPlayerId.get(id)).filter(Boolean));
      return assignedTeams.size > 1;
    })
    .map(group => group.label || group.id);
}

function buildDraftSignature(iteration: TeamIteration) {
  return JSON.stringify(
    iteration.teams
      .map(team => team.players.map(player => player.id).sort())
      .sort((left, right) => left.join(',').localeCompare(right.join(',')))
  );
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function backupWorkspace(record: LoadedWorkspaceRecord) {
  const backupPath = path.resolve(
    `backup-${record.workspace.id}-before-female-exec-and-three-drafts-${timestampSlug()}.json`
  );
  await fs.writeFile(backupPath, JSON.stringify(record.workspace, null, 2), 'utf8');
  return backupPath;
}

async function createFallbackTeamIteration(input: {
  config: SavedWorkspace['config'];
  name: string;
  playerGroups: PlayerGroup[];
  players: Player[];
  variant: 'primary' | 'alternate';
}): Promise<TeamIteration> {
  const candidatePlayers = input.variant === 'alternate'
    ? shuffleItems(input.players.map(clonePlayer))
    : input.players.map(clonePlayer);
  const candidateGroups = clonePlayerGroups(input.playerGroups, candidatePlayers);
  const generation = generateBalancedTeams(
    candidatePlayers,
    input.config,
    candidateGroups,
    input.variant === 'alternate',
    false,
  );

  return {
    id: `ai-iteration-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: input.name,
    type: 'ai',
    status: 'ready',
    generationSource: 'fallback',
    teams: generation.teams.map(cloneTeam),
    unassignedPlayers: generation.unassignedPlayers.map(clonePlayer),
    stats: cloneStats(generation.stats),
    createdAt: new Date().toISOString(),
  };
}

async function runUpdate() {
  await loadLocalEnv();
  const rankings = loadRankings();
  let backupPath: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const loaded = await resolveWorkspaceRecord({ workspaceName: WORKSPACE_NAME, userId: USER_ID });
    if (!backupPath) {
      backupPath = await backupWorkspace(loaded);
    }

    try {
      const workspace: SavedWorkspace = JSON.parse(JSON.stringify(loaded.workspace));
      const rankingUpdate = applyFemaleRankings(workspace, rankings);
      const buildResult = await buildWorkspaceWithGeneratedDrafts(workspace, { draftCount: 3 }, {
        createTeamIteration: createFallbackTeamIteration,
      });

      const cleanedWorkspace = cleanUndefinedDeep(buildResult.workspace);
      await saveWorkspaceRecord(cleanedWorkspace, {
        expectedRevision: loaded.workspace.revision,
        expectedUpdateTime: loaded.updateTime,
      });

      const verified = await resolveWorkspaceRecord({ workspaceId: buildResult.workspace.id });
      const draftIds = new Set(buildResult.generatedDrafts.map(draft => draft.iteration.id));
      const verifiedDrafts = (verified.workspace.teamIterations ?? []).filter(iteration => draftIds.has(iteration.id));

      const femalePlayers = verified.workspace.players.filter(player => player.gender === 'F');
      const femaleMismatch = femalePlayers
        .map(player => {
          const matchedSheetName = matchRankingName(player.name, [...rankings.keys()]);
          if (!matchedSheetName) {
            return null;
          }
          const expected = rankings.get(matchedSheetName)!;
          return player.execSkillRating === expected ? null : { name: player.name, expected, actual: player.execSkillRating };
        })
        .filter(Boolean);

      const draftChecks = verifiedDrafts.map(iteration => {
        const spread = computeGenderSpread(iteration);
        return {
          id: iteration.id,
          name: iteration.name,
          teams: iteration.teams.length,
          unassigned: iteration.unassignedPlayers.length,
          maleCounts: spread.maleCounts,
          femaleCounts: spread.femaleCounts,
          maleSpread: spread.maleSpread,
          femaleSpread: spread.femaleSpread,
          splitGroups: verifyGroupsStayTogether(iteration, verified.workspace.playerGroups ?? []),
          signature: buildDraftSignature(iteration),
        };
      });

      const uniqueDraftSignatures = new Set(draftChecks.map(check => check.signature));

      return {
        backupPath,
        attempt,
        rankingUpdate,
        verifiedWorkspace: {
          id: verified.workspace.id,
          name: verified.workspace.name,
          revision: verified.workspace.revision,
          updatedAt: verified.workspace.updatedAt,
          targetTeams: verified.workspace.config.targetTeams,
          activeTeamIterationId: verified.workspace.activeTeamIterationId,
          totalIterations: verified.workspace.teamIterations?.length ?? 0,
          execHistoryCount: Object.keys(verified.workspace.execRatingHistory ?? {}).length,
        },
        femaleMismatch,
        draftChecks,
        uniqueDraftCount: uniqueDraftSignatures.size,
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isConflict = message.includes('stored version') || message.includes('Workspace revision changed');
      if (!isConflict || attempt === MAX_RETRIES) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const result = await runUpdate();
console.log(JSON.stringify(result, null, 2));

