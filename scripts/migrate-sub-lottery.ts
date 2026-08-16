import fs from 'node:fs/promises';
import path from 'node:path';
import { getSubLotteryFirestore } from '../src/server/sub-lottery/firebaseAdmin.js';
import { getWeekStartDateForGameDate } from '../src/sub-lottery/workflow.js';
import { loadLocalEnv } from '../src/server/workspaces/firebaseWorkspaceAccess.js';

const apply = process.argv.includes('--apply');
await loadLocalEnv();
const seasonId = process.argv.find(value => value.startsWith('--season='))?.split('=')[1] || process.env.SUB_LOTTERY_SEASON_ID || 'default-season';
const db = await getSubLotteryFirestore();
const collections = ['subLotterySchedule', 'subLotteryRequests', 'subLotteryAssignments'] as const;
const snapshots = await Promise.all(collections.map(name => db.collection(name).where('seasonId', '==', seasonId).get()));
const backup = Object.fromEntries(snapshots.map((snapshot, index) => [collections[index], snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))]));
const changes: Array<{ collection: string; id: string; weekStartDate: string }> = [];
const scheduleWeeks = new Map<string, string>();
snapshots[0].docs.forEach(doc => { const data = doc.data(); if (data.gameDate) scheduleWeeks.set(doc.id, data.weekStartDate || getWeekStartDateForGameDate(String(data.gameDate))); });
snapshots.forEach((snapshot, index) => snapshot.docs.forEach(doc => { const data = doc.data(); const weekStartDate = data.weekStartDate || (data.gameDate ? getWeekStartDateForGameDate(String(data.gameDate)) : data.scheduleEntryId ? scheduleWeeks.get(String(data.scheduleEntryId)) : undefined); if (weekStartDate && !data.weekStartDate) changes.push({ collection: collections[index], id: doc.id, weekStartDate }); }));
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', seasonId, documentsScanned: snapshots.reduce((sum, item) => sum + item.size, 0), changes }, null, 2));
if (apply && changes.length) {
  const directory = path.resolve('tmp', 'sub-lottery-migrations'); await fs.mkdir(directory, { recursive: true });
  const backupPath = path.join(directory, `${seasonId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`); await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
  const batch = db.batch(); changes.forEach(change => batch.update(db.collection(change.collection).doc(change.id), { weekStartDate: change.weekStartDate })); await batch.commit(); console.log(`Backup: ${backupPath}`);
}
