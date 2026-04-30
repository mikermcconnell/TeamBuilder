import { loadLocalEnv, resolveWorkspaceRecord } from './src/server/workspaces/firebaseWorkspaceAccess.ts';
await loadLocalEnv();
const record = await resolveWorkspaceRecord({ workspaceName: 'Spring league 134', userId: '81MVUsmm6mYkyHUwA6bvL0b4opU2' });
const counts = {M:0,F:0,Other:0};
for (const p of record.workspace.players) counts[p.gender] += 1;
console.log(counts);
const harr = record.workspace.players.filter(p => p.name.toLowerCase().includes('harrington') || p.name.toLowerCase().includes('mussgnug') || p.name.toLowerCase().includes('kileigh'));
console.log(harr);
