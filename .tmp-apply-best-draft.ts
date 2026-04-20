import authModule from './node_modules/.pnpm/firebase-tools@15.10.1_@types+node@22.15.34_typescript@5.6.3/node_modules/firebase-tools/lib/auth.js';
import { generateBalancedTeams } from './src/utils/teamGenerator.ts';

const auth = authModule;
const fetchFn = global.fetch;
const PROJECT_ID = 'teambuilder-3b79e';
const USER_ID = '81MVUsmm6mYkyHUwA6bvL0b4opU2';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
function decode(v){if(v==null)return null; if('nullValue'in v)return null; if('stringValue'in v)return v.stringValue; if('integerValue'in v)return Number(v.integerValue); if('doubleValue'in v)return Number(v.doubleValue); if('booleanValue'in v)return v.booleanValue; if('timestampValue'in v)return v.timestampValue; if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode); if('mapValue'in v){const o={}; for(const [k,val] of Object.entries(v.mapValue.fields||{})) o[k]=decode(val); return o;} return v;}
function encode(v){ if(v===null||v===undefined) return { nullValue: null }; if(Array.isArray(v)) return { arrayValue: { values: v.map(encode) } }; if(typeof v==='string') return { stringValue: v }; if(typeof v==='boolean') return { booleanValue: v }; if(typeof v==='number') return Number.isInteger(v)?{ integerValue: String(v) }:{ doubleValue: v }; if(typeof v==='object'){ const fields={}; for(const [k,val] of Object.entries(v)){ if(val!==undefined) fields[k]=encode(val);} return { mapValue: { fields } }; } throw new Error(`Unsupported type ${typeof v}`); }
function clone(x){return JSON.parse(JSON.stringify(x));}
function shuffle(arr){const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a;}
function effectiveSkill(p){return typeof p.execSkillRating==='number'?p.execSkillRating:p.skillRating;}
function countByTeam(teams, fn){return teams.map(t=>t.players.filter(fn).length).sort((a,b)=>b-a);}
function targetCounts(total,b){const base=Math.floor(total/b); const rem=total%b; return Array.from({length:b},(_,i)=>base+(i<rem?1:0)).sort((a,b)=>b-a);}
function sumAbsDiff(a,b){return a.reduce((s,v,i)=>s+Math.abs(v-(b[i]??0)),0);}
function getPlayerAge(p){return p?.profile?.age ?? p?.age ?? null;}
function scoreDraft(result, players, playerGroups){ const teams=result.teams; const unassigned=result.unassignedPlayers?.length??0; const assigned=new Map(); for(const t of teams){for(const p of t.players) assigned.set(p.id,t.id);} let splitGroups=0; for(const g of playerGroups||[]){const ids=(g.playerIds||[]).filter(Boolean); const teamIds=new Set(ids.map(id=>assigned.get(id)).filter(Boolean)); if(teamIds.size>1) splitGroups++;} const teamSizes=teams.map(t=>t.players.length).sort((a,b)=>b-a); const sizeTarget=targetCounts(players.length-unassigned,teams.length); const teamSizeDiff=sumAbsDiff(teamSizes,sizeTarget); const femaleCounts=teams.map(t=>t.players.filter(p=>p.gender==='F').length).sort((a,b)=>b-a); const maleCounts=teams.map(t=>t.players.filter(p=>p.gender==='M').length).sort((a,b)=>b-a); const femaleTarget=targetCounts(players.filter(p=>p.gender==='F').length,teams.length); const maleTarget=targetCounts(players.filter(p=>p.gender==='M').length,teams.length); const femaleDiff=sumAbsDiff(femaleCounts,femaleTarget); const maleDiff=sumAbsDiff(maleCounts,maleTarget); const avgSkills=teams.map(t=>t.players.length?t.players.reduce((s,p)=>s+effectiveSkill(p),0)/t.players.length:0); const overallAvg=players.reduce((s,p)=>s+effectiveSkill(p),0)/players.length; const skillSpread=Math.max(...avgSkills)-Math.min(...avgSkills); const skillDeviation=avgSkills.reduce((s,v)=>s+Math.abs(v-overallAvg),0); const handlerCounts=countByTeam(teams,p=>p.isHandler===true); const handlerTarget=targetCounts(players.filter(p=>p.isHandler===true).length,teams.length); const handlerDiff=sumAbsDiff(handlerCounts,handlerTarget); const returningCounts=countByTeam(teams,p=>p.isNewPlayer===false); const returningTarget=targetCounts(players.filter(p=>p.isNewPlayer===false).length,teams.length); const returningDiff=sumAbsDiff(returningCounts,returningTarget); const newCounts=countByTeam(teams,p=>p.isNewPlayer===true); const newTarget=targetCounts(players.filter(p=>p.isNewPlayer===true).length,teams.length); const newDiff=sumAbsDiff(newCounts,newTarget); const youngCounts=countByTeam(teams,p=>{const age=getPlayerAge(p); return typeof age==='number' && age<=24;}); const youngTarget=targetCounts(players.filter(p=>{const age=getPlayerAge(p); return typeof age==='number'&&age<=24;}).length,teams.length); const youngDiff=sumAbsDiff(youngCounts,youngTarget); const wiseCounts=countByTeam(teams,p=>{const age=getPlayerAge(p); return typeof age==='number' && age>=45;}); const wiseTarget=targetCounts(players.filter(p=>{const age=getPlayerAge(p); return typeof age==='number'&&age>=45;}).length,teams.length); const wiseDiff=sumAbsDiff(wiseCounts,wiseTarget); return {score:[splitGroups,unassigned,teamSizeDiff,femaleDiff,maleDiff,Number(skillSpread.toFixed(4)),Number(skillDeviation.toFixed(4)),handlerDiff,returningDiff,newDiff,youngDiff,wiseDiff], metrics:{splitGroups,unassigned,teamSizeDiff,femaleCounts,maleCounts,skillSpread:Number(skillSpread.toFixed(3)),skillDeviation:Number(skillDeviation.toFixed(3)),handlerCounts,handlerDiff,returningCounts,returningDiff,newCounts,newDiff,youngCounts,youngDiff,wiseCounts,wiseDiff}}; }
function compareScore(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]??0; const bv=b[i]??0; if(av<bv) return -1; if(av>bv) return 1;} return 0;}
function remapGroups(players, groups){const m=new Map(players.map(p=>[p.id,p])); return groups.map(g=>({...g, playerIds:[...(g.playerIds||[])], players:(g.playerIds||[]).map(id=>m.get(id)).filter(Boolean)}));}
async function fetchDoc(token, relPath){ const res=await fetchFn(`${BASE}/${relPath}`,{headers:{Authorization:`Bearer ${token}`}}); const json=await res.json(); if(!res.ok) throw new Error(`Fetch ${relPath} failed: ${res.status} ${JSON.stringify(json)}`); return {raw:json,data:decode({mapValue:{fields:json.fields}})}; }
async function patchDoc(token, relPath, data){ const res=await fetchFn(`${BASE}/${relPath}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({fields:encode(data).mapValue.fields})}); const json=await res.json(); if(!res.ok) throw new Error(`Patch ${relPath} failed: ${res.status} ${JSON.stringify(json)}`); return json; }
function assignTeamIds(players, teams){ const teamByPlayerId=new Map(); for(const t of teams){ for(const p of t.players) teamByPlayerId.set(p.id, t.id);} return players.map(p=>({ ...p, teamId: teamByPlayerId.get(p.id) })); }
function syncGroups(players, groups){ const map=new Map(players.map(p=>[p.id,p])); return (groups||[]).map(g=>({ ...g, playerIds:[...(g.playerIds||[])], players:(g.playerIds||[]).map(id=>map.get(id)).filter(Boolean) })); }

const michael=auth.getAllAccounts().find(a=>a.user?.email==='michaelryanmcconnell@gmail.com') ?? auth.getAllAccounts()[0];
const tok=await auth.getAccessToken(michael.tokens.refresh_token,michael.tokens.scopes);
const token=tok.access_token;
const wsRes=await fetchFn(`${BASE}/workspaces?pageSize=200`,{headers:{Authorization:`Bearer ${token}`}}); const wsJson=await wsRes.json(); if(!wsRes.ok) throw new Error(JSON.stringify(wsJson));
const currentWorkspace=(wsJson.documents||[]).map(doc=>({id:doc.name.split('/').pop(), data:decode({mapValue:{fields:doc.fields}})})).filter(w=>w.data?.userId===USER_ID).sort((a,b)=>new Date(b.data?.updatedAt||0).getTime()-new Date(a.data?.updatedAt||0).getTime())[0];
if(!currentWorkspace) throw new Error('No workspace found');
const workspacePath=`workspaces/${currentWorkspace.id}`;
const appStatePath=`users/${USER_ID}/data/appState`;
const [workspaceDoc, appStateDoc]=await Promise.all([fetchDoc(token, workspacePath), fetchDoc(token, appStatePath)]);
const source=clone(appStateDoc.data);
const players=clone(source.players||[]);
const groups=clone(source.playerGroups||[]);
const config={...clone(source.config||{}), targetTeams:10, maxTeamSize:12, minFemales:4, minMales:7, allowMixedGender:true, restrictToEvenTeams:true};
let best=null;
for(let i=0;i<300;i++){
 const shuffled=shuffle(players.map(p=>({ ...p, teamId: undefined })));
 const remapped=remapGroups(shuffled, groups);
 const result=generateBalancedTeams(clone(shuffled), config, remapped, i%2===1, false);
 const evaluation=scoreDraft(result, shuffled, remapped);
 if(!best || compareScore(evaluation.score, best.evaluation.score)<0){ best={ i, result, evaluation }; }
}
if(!best) throw new Error('No draft candidate found');
const playersWithTeams=assignTeamIds(players, best.result.teams);
const syncedGroups=syncGroups(playersWithTeams, groups);
const createdAt=new Date().toISOString();
const iterationId=`iteration-ai-${Date.now()}`;
const summary='Built as the AI tab option using TeamBuilder fallback balancing with this priority order: keep groups together first, then balance male/female counts, then skill, then handlers, then new vs returning players, then young vs wise players.';
const iteration={ id: iterationId, name:'AI 1', type:'ai', status:'ready', generationSource:'fallback', teams:best.result.teams, unassignedPlayers:best.result.unassignedPlayers, stats:best.result.stats, createdAt, errorMessage:summary };
const futureStamp=new Date(Date.now()+2*60*1000).toISOString();
const workspaceOut=clone(workspaceDoc.data); workspaceOut.players=playersWithTeams; workspaceOut.playerGroups=syncedGroups; workspaceOut.config=config; workspaceOut.teams=best.result.teams; workspaceOut.unassignedPlayers=best.result.unassignedPlayers; workspaceOut.stats=best.result.stats; workspaceOut.teamIterations=[iteration]; workspaceOut.activeTeamIterationId=iterationId; workspaceOut.updatedAt=futureStamp;
const appStateOut=clone(appStateDoc.data); appStateOut.players=playersWithTeams; appStateOut.playerGroups=syncedGroups; appStateOut.config=config; appStateOut.teams=best.result.teams; appStateOut.unassignedPlayers=best.result.unassignedPlayers; appStateOut.stats=best.result.stats; appStateOut.teamIterations=[iteration]; appStateOut.activeTeamIterationId=iterationId; appStateOut.lastUpdated=futureStamp;
await patchDoc(token, workspacePath, workspaceOut); await patchDoc(token, appStatePath, appStateOut);
console.log(JSON.stringify({ workspaceId: currentWorkspace.id, workspaceName: currentWorkspace.data?.name, config, score: best.evaluation.score, metrics: best.evaluation.metrics, teamSummaries: best.result.teams.map(t=>({name:t.name,size:t.players.length,m:t.genderBreakdown.M,f:t.genderBreakdown.F,h:t.handlerCount||0,avg:Number(t.averageSkill.toFixed(2))})) }, null, 2));
