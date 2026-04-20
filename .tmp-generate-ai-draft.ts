import authModule from './node_modules/.pnpm/firebase-tools@15.10.1_@types+node@22.15.34_typescript@5.6.3/node_modules/firebase-tools/lib/auth.js';
import { generateBalancedTeams, buildGenerationResult } from './src/utils/teamGenerator.ts';
import { generateTeamDraftWithFallback } from './src/server/ai/teamDraftOrchestrator.ts';
import { buildTeamsFromDraft } from './src/shared/ai-draft.ts';

const auth = authModule;
const fetchFn = global.fetch;
const PROJECT_ID = 'teambuilder-3b79e';
const USER_ID = '81MVUsmm6mYkyHUwA6bvL0b4opU2';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function decode(v) {
  if (v == null) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) {
    const obj = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = decode(val);
    return obj;
  }
  return v;
}

function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) if (val !== undefined) fields[k] = encode(val);
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported type: ${typeof v}`);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function effectiveSkill(player) {
  return typeof player.execSkillRating === 'number' ? player.execSkillRating : player.skillRating;
}

function countByTeam(teams, fn) {
  return teams.map(team => team.players.filter(fn).length).sort((a, b) => b - a);
}

function targetCounts(total, buckets) {
  const base = Math.floor(total / buckets);
  const rem = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < rem ? 1 : 0)).sort((a, b) => b - a);
}

function sumAbsDiff(a, b) {
  return a.reduce((sum, value, i) => sum + Math.abs(value - (b[i] ?? 0)), 0);
}

function getPlayerAge(player) {
  return player?.profile?.age ?? player?.age ?? null;
}

function scoreDraft(result, players, playerGroups) {
  const teams = result.teams;
  const unassigned = result.unassignedPlayers?.length ?? 0;
  const assigned = new Map();
  for (const team of teams) {
    for (const player of team.players) assigned.set(player.id, team.id);
  }

  let splitGroups = 0;
  for (const group of playerGroups || []) {
    const ids = (group.playerIds || []).filter(Boolean);
    const teamIds = new Set(ids.map(id => assigned.get(id)).filter(Boolean));
    if (teamIds.size > 1) splitGroups += 1;
  }

  const teamSizes = teams.map(team => team.players.length).sort((a, b) => b - a);
  const sizeTarget = targetCounts(players.length - unassigned, teams.length);
  const teamSizeDiff = sumAbsDiff(teamSizes, sizeTarget);

  const femaleCounts = teams.map(team => team.players.filter(p => p.gender === 'F').length).sort((a, b) => b - a);
  const maleCounts = teams.map(team => team.players.filter(p => p.gender === 'M').length).sort((a, b) => b - a);
  const femaleTarget = targetCounts(players.filter(p => p.gender === 'F').length, teams.length);
  const maleTarget = targetCounts(players.filter(p => p.gender === 'M').length, teams.length);
  const femaleDiff = sumAbsDiff(femaleCounts, femaleTarget);
  const maleDiff = sumAbsDiff(maleCounts, maleTarget);

  const avgSkills = teams.map(team => team.players.length ? team.players.reduce((sum, p) => sum + effectiveSkill(p), 0) / team.players.length : 0);
  const overallAvg = players.reduce((sum, p) => sum + effectiveSkill(p), 0) / players.length;
  const skillSpread = Math.max(...avgSkills) - Math.min(...avgSkills);
  const skillDeviation = avgSkills.reduce((sum, value) => sum + Math.abs(value - overallAvg), 0);

  const handlerCounts = countByTeam(teams, p => p.isHandler === true);
  const handlerTarget = targetCounts(players.filter(p => p.isHandler === true).length, teams.length);
  const handlerDiff = sumAbsDiff(handlerCounts, handlerTarget);

  const returningCounts = countByTeam(teams, p => p.isNewPlayer === false);
  const returningTarget = targetCounts(players.filter(p => p.isNewPlayer === false).length, teams.length);
  const returningDiff = sumAbsDiff(returningCounts, returningTarget);

  const newCounts = countByTeam(teams, p => p.isNewPlayer === true);
  const newTarget = targetCounts(players.filter(p => p.isNewPlayer === true).length, teams.length);
  const newDiff = sumAbsDiff(newCounts, newTarget);

  const youngCounts = countByTeam(teams, p => {
    const age = getPlayerAge(p);
    return typeof age === 'number' && age <= 24;
  });
  const youngTarget = targetCounts(players.filter(p => {
    const age = getPlayerAge(p);
    return typeof age === 'number' && age <= 24;
  }).length, teams.length);
  const youngDiff = sumAbsDiff(youngCounts, youngTarget);

  const wiseCounts = countByTeam(teams, p => {
    const age = getPlayerAge(p);
    return typeof age === 'number' && age >= 45;
  });
  const wiseTarget = targetCounts(players.filter(p => {
    const age = getPlayerAge(p);
    return typeof age === 'number' && age >= 45;
  }).length, teams.length);
  const wiseDiff = sumAbsDiff(wiseCounts, wiseTarget);

  const score = [
    splitGroups,
    unassigned,
    teamSizeDiff,
    femaleDiff,
    maleDiff,
    Number(skillSpread.toFixed(4)),
    Number(skillDeviation.toFixed(4)),
    handlerDiff,
    returningDiff,
    newDiff,
    youngDiff,
    wiseDiff,
  ];

  return {
    score,
    metrics: {
      splitGroups,
      unassigned,
      teamSizeDiff,
      femaleCounts,
      maleCounts,
      femaleTarget,
      maleTarget,
      skillSpread: Number(skillSpread.toFixed(3)),
      skillDeviation: Number(skillDeviation.toFixed(3)),
      handlerCounts,
      handlerTarget,
      handlerDiff,
      returningCounts,
      returningTarget,
      returningDiff,
      newCounts,
      newTarget,
      newDiff,
      youngCounts,
      youngTarget,
      youngDiff,
      wiseCounts,
      wiseTarget,
      wiseDiff,
    },
  };
}

function compareScore(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

async function fetchDoc(token, relPath) {
  const res = await fetchFn(`${BASE}/${relPath}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`Fetch ${relPath} failed: ${res.status} ${JSON.stringify(json)}`);
  return { raw: json, data: decode({ mapValue: { fields: json.fields } }) };
}

async function patchDoc(token, relPath, data) {
  const res = await fetchFn(`${BASE}/${relPath}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: encode(data).mapValue.fields }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Patch ${relPath} failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

function assignTeamIds(players, teams) {
  const teamByPlayerId = new Map();
  for (const team of teams) {
    for (const player of team.players) teamByPlayerId.set(player.id, team.id);
  }
  return players.map(player => ({ ...player, teamId: teamByPlayerId.get(player.id) }));
}

function syncGroups(players, groups) {
  const map = new Map(players.map(p => [p.id, p]));
  return (groups || []).map(group => ({
    ...group,
    playerIds: [...(group.playerIds || [])],
    players: (group.playerIds || []).map(id => map.get(id)).filter(Boolean),
  }));
}

const accounts = auth.getAllAccounts();
const michael = accounts.find(a => a.user?.email === 'michaelryanmcconnell@gmail.com') ?? accounts[0];
if (!michael) throw new Error('No Firebase CLI account found');
const tokenObj = await auth.getAccessToken(michael.tokens.refresh_token, michael.tokens.scopes);
const token = tokenObj.access_token;

const workspacesRes = await fetchFn(`${BASE}/workspaces?pageSize=200`, { headers: { Authorization: `Bearer ${token}` } });
const workspacesJson = await workspacesRes.json();
if (!workspacesRes.ok) throw new Error(JSON.stringify(workspacesJson));
const workspaces = (workspacesJson.documents || []).map(doc => ({
  id: doc.name.split('/').pop(),
  data: decode({ mapValue: { fields: doc.fields } }),
}));
const currentWorkspace = workspaces
  .filter(w => w.data?.userId === USER_ID)
  .sort((a, b) => new Date(b.data?.updatedAt || 0).getTime() - new Date(a.data?.updatedAt || 0).getTime())[0];
if (!currentWorkspace) throw new Error('No workspace found for target user');

const workspacePath = `workspaces/${currentWorkspace.id}`;
const appStatePath = `users/${USER_ID}/data/appState`;
const [workspaceDoc, appStateDoc] = await Promise.all([
  fetchDoc(token, workspacePath),
  fetchDoc(token, appStatePath),
]);

const source = appStateDoc.data;
const players = clone(source.players || []);
const playerGroups = clone(source.playerGroups || []);
const generationConfig = {
  ...clone(source.config || {}),
  targetTeams: 10,
  maxTeamSize: 12,
  minFemales: 4,
  minMales: 7,
  allowMixedGender: true,
  restrictToEvenTeams: true,
};

const seed = generateBalancedTeams(clone(players), generationConfig, clone(playerGroups), false, false);
const candidates = [];
for (const variant of ['primary', 'alternate']) {
  const payload = await generateTeamDraftWithFallback({
    players: players.map(player => ({
      id: player.id,
      name: player.name,
      gender: player.gender,
      skillRating: player.skillRating,
      execSkillRating: player.execSkillRating ?? null,
      isHandler: player.isHandler,
      teammateRequests: [...(player.teammateRequests || [])],
      avoidRequests: [...(player.avoidRequests || [])],
      teamId: player.teamId,
      groupId: player.groupId,
    })),
    config: generationConfig,
    playerGroups: playerGroups.map(group => ({ id: group.id, label: group.label, playerIds: [...(group.playerIds || [])] })),
    variant,
  });

  const built = buildTeamsFromDraft(payload, players, seed.teams);
  const finalResult = buildGenerationResult(players, built.teams, built.unassignedPlayers, generationConfig, playerGroups);
  const evaluation = scoreDraft(finalResult, players, playerGroups);
  candidates.push({ variant, payload, result: finalResult, evaluation });
}

candidates.sort((a, b) => compareScore(a.evaluation.score, b.evaluation.score));
const best = candidates[0];
if (!best) throw new Error('No draft candidates generated');

const iterationId = `iteration-ai-${Date.now()}`;
const createdAt = new Date().toISOString();
const playersWithTeams = assignTeamIds(players, best.result.teams);
const syncedGroups = syncGroups(playersWithTeams, playerGroups);
const iteration = {
  id: iterationId,
  name: 'AI 1',
  type: 'ai',
  status: 'ready',
  generationSource: best.payload.source === 'fallback' ? 'fallback' : 'ai',
  aiModel: best.payload.model,
  aiResponseId: best.payload.responseId,
  aiResponseIds: best.payload.responseIds,
  teams: best.result.teams,
  unassignedPlayers: best.result.unassignedPlayers,
  stats: best.result.stats,
  createdAt,
  errorMessage: best.payload.summary,
};

const futureStamp = new Date(Date.now() + 2 * 60 * 1000).toISOString();
const workspaceOut = clone(workspaceDoc.data);
workspaceOut.players = playersWithTeams;
workspaceOut.playerGroups = syncedGroups;
workspaceOut.config = generationConfig;
workspaceOut.teams = best.result.teams;
workspaceOut.unassignedPlayers = best.result.unassignedPlayers;
workspaceOut.stats = best.result.stats;
workspaceOut.teamIterations = [iteration];
workspaceOut.activeTeamIterationId = iterationId;
workspaceOut.updatedAt = futureStamp;

const appStateOut = clone(appStateDoc.data);
appStateOut.players = playersWithTeams;
appStateOut.playerGroups = syncedGroups;
appStateOut.config = generationConfig;
appStateOut.teams = best.result.teams;
appStateOut.unassignedPlayers = best.result.unassignedPlayers;
appStateOut.stats = best.result.stats;
appStateOut.teamIterations = [iteration];
appStateOut.activeTeamIterationId = iterationId;
appStateOut.lastUpdated = futureStamp;

await patchDoc(token, workspacePath, workspaceOut);
await patchDoc(token, appStatePath, appStateOut);

console.log(JSON.stringify({
  workspaceId: currentWorkspace.id,
  workspaceName: currentWorkspace.data?.name,
  generationConfig,
  chosenVariant: best.variant,
  source: best.payload.source,
  summary: best.payload.summary,
  score: best.evaluation.score,
  metrics: best.evaluation.metrics,
  teamSizes: best.result.teams.map(t => ({ name: t.name, size: t.players.length, male: t.genderBreakdown.M, female: t.genderBreakdown.F, handlers: t.handlerCount || t.players.filter(p => p.isHandler).length, avgSkill: Number(t.averageSkill.toFixed(2)) })),
}, null, 2));
