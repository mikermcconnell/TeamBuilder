import XLSX from 'xlsx';
import { loadLocalEnv, resolveWorkspaceRecord } from './src/server/workspaces/firebaseWorkspaceAccess.ts';
import { generateBalancedTeams } from './src/utils/teamGenerator.ts';
import type { Player, PlayerGroup } from './src/types/index.ts';

const USER_ID='81MVUsmm6mYkyHUwA6bvL0b4opU2';
const WORKSPACE_NAME='Spring league 134';

function normalizeLetters(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g,'');
}
function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts.slice(0,-1).join(' ') || parts[0] || '', last: parts.at(-1) || '' };
}
function matchRankingName(sourceName: string, targetNames: string[]): string | null {
  const aliasMap = new Map<string, string>([['Steph Vecchiarelli','Stephanie Vecchiarelli']]);
  if (aliasMap.has(sourceName)) return aliasMap.get(sourceName)!;
  const exact = targetNames.find(name => normalizeLetters(name) === normalizeLetters(sourceName));
  if (exact) return exact;
  const source = splitName(sourceName);
  const sf = normalizeLetters(source.first), sl = normalizeLetters(source.last);
  const matches = targetNames.filter(name => {
    const target = splitName(name); const tf = normalizeLetters(target.first), tl = normalizeLetters(target.last);
    return sl && sl === tl && (tf.startsWith(sf) || sf.startsWith(tf));
  });
  return matches.length === 1 ? matches[0]! : null;
}
function clonePlayer(player: Player): Player { return JSON.parse(JSON.stringify(player)); }
function cloneGroups(groups: PlayerGroup[], players: Player[]): PlayerGroup[] {
  const byId = new Map(players.map(p=>[p.id,p]));
  return groups.map(g=>({...g, playerIds:[...g.playerIds], players:g.playerIds.map(id=>byId.get(id)).filter(Boolean) as Player[]}));
}
function shuffle<T>(items:T[]):T[]{ const arr=[...items]; for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j]!,arr[i]!];} return arr; }
function genderSpread(teams:any[]){ const ms=teams.map(t=>t.genderBreakdown.M), fs=teams.map(t=>t.genderBreakdown.F); return {maleSpread:Math.max(...ms)-Math.min(...ms), femaleSpread:Math.max(...fs)-Math.min(...fs), maleCounts:ms, femaleCounts:fs}; }
function skillSpread(teams:any[]){ const vals=teams.map(t=>t.averageSkill||0); return Math.max(...vals)-Math.min(...vals); }

await loadLocalEnv();
const workbook = XLSX.readFile('Female Spring rankings.ods', { cellText:true, cellDates:false });
const sheet = workbook.Sheets[workbook.SheetNames[0]!];
const rows = XLSX.utils.sheet_to_json<(string|number)[]>(sheet, { header:1, raw:false, defval:''});
const rankings = new Map<string, number>();
for (const row of rows.slice(1)) {
  const first=String(row[0]??'').trim(); const last=String(row[1]??'').trim(); const avg=Number(String(row[11]??'').trim());
  if ((!first && !last) || !Number.isFinite(avg)) continue; rankings.set(`${first} ${last}`.trim(), avg);
}
const record = await resolveWorkspaceRecord({ workspaceName: WORKSPACE_NAME, userId: USER_ID });
const players = record.workspace.players.map(clonePlayer);
const femaleNames = players.filter(p=>p.gender==='F').map(p=>p.name);
for (const [sheetName, rating] of rankings.entries()) {
  const matched = matchRankingName(sheetName, femaleNames); if (!matched) continue; const p = players.find(p=>p.name===matched)!; p.execSkillRating = rating;
}
let best:any = null;
let found:any[] = [];
for (let attempt=1; attempt<=5000; attempt++) {
  const candidatePlayers = shuffle(players.map(clonePlayer));
  const candidateGroups = cloneGroups(record.workspace.playerGroups ?? [], candidatePlayers);
  const result = generateBalancedTeams(candidatePlayers, record.workspace.config, candidateGroups, true, false);
  const spread = genderSpread(result.teams);
  const summary = {attempt, unassigned: result.unassignedPlayers.length, maleSpread: spread.maleSpread, femaleSpread: spread.femaleSpread, maleCounts: spread.maleCounts, femaleCounts: spread.femaleCounts, skillSpread: skillSpread(result.teams)};
  if (!best || summary.unassigned < best.unassigned || (summary.unassigned===best.unassigned && summary.maleSpread+summary.femaleSpread < best.maleSpread+best.femaleSpread) || (summary.unassigned===best.unassigned && summary.maleSpread+summary.femaleSpread===best.maleSpread+best.femaleSpread && summary.skillSpread < best.skillSpread)) best = summary;
  if (summary.unassigned===0 && summary.maleSpread<=1 && summary.femaleSpread<=1) { found.push(summary); if (found.length>=5) break; }
}
console.log(JSON.stringify({best, foundCount: found.length, found}, null, 2));
