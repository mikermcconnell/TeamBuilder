import { beforeEach, describe, expect, test, vi } from 'vitest';

type Data = Record<string, unknown>;
const store = new Map<string, Data>();

function ref(collection: string, id: string) {
  const key = `${collection}/${id}`;
  return {
    id,
    get: async () => ({ id, exists: store.has(key), data: () => store.get(key) }),
    key,
  };
}

function snapshot(collection: string, filters: Array<[string, unknown]>, limit?: number) {
  const docs = [...store.entries()].filter(([key, data]) => key.startsWith(`${collection}/`) && filters.every(([field, value]) => data[field] === value))
    .slice(0, limit).map(([key, data]) => ({ id: key.slice(collection.length + 1), data: () => data, ref: ref(collection, key.slice(collection.length + 1)) }));
  return { docs, empty: docs.length === 0 };
}

function query(collection: string, filters: Array<[string, unknown]> = [], max?: number): Data {
  return {
    where: (field: string, _operator: string, value: unknown) => query(collection, [...filters, [field, value]], max),
    limit: (count: number) => query(collection, filters, count),
    get: async () => snapshot(collection, filters, max),
    doc: (id: string) => ref(collection, id),
  };
}

vi.mock('@/server/sub-lottery/firebaseAdmin', () => ({
  getSubLotteryFirestore: vi.fn(async () => ({
    collection: (name: string) => query(name),
    runTransaction: async (action: (transaction: Data) => Promise<unknown>) => {
      const writes: Array<() => void> = [];
      const transaction = {
        get: (document: ReturnType<typeof ref>) => document.get(),
        set: (document: ReturnType<typeof ref>, data: Data) => writes.push(() => store.set(document.key, data)),
        update: (document: ReturnType<typeof ref>, data: Data) => writes.push(() => store.set(document.key, { ...store.get(document.key), ...data })),
      };
      const result = await action(transaction);
      writes.forEach(write => write());
      return result;
    },
  })),
}));

import { createSubRequest } from '@/server/sub-lottery/service';

describe('captain need submission', () => {
  const seasonId = 'testing-2026-06-22';
  const base = {
    seasonId,
    captainPin: 'testing',
    scheduleEntryId: 'game-1',
    submissionId: 'first-submission',
    needs: [{ pool: 'open' as const, slotsNeeded: 2 }, { pool: 'female' as const, slotsNeeded: 1 }],
  };

  beforeEach(() => {
    store.clear();
    store.set(`subLotterySeasons/${seasonId}`, { name: 'Test', weekStartDate: '2026-06-22' });
    store.set('subLotterySchedule/game-1', {
      id: 'game-1', seasonId, active: true, gameDate: '2026-06-24', weekStartDate: '2026-06-22',
      captainName: 'Morgan', teamName: 'Blue Team', gameLabel: 'Wed 7 PM', weekLabel: 'Week 1', pool: 'open',
    });
  });

  test('saves both pools together and replays a submission without adding slots twice', async () => {
    const first = await createSubRequest(base);
    expect(first.requests).toHaveLength(2);
    expect(first.requests.map(request => request.slotsNeeded).sort()).toEqual([1, 2]);
    const replay = await createSubRequest(base);
    expect(replay.requests.map(request => request.slotsNeeded).sort()).toEqual([1, 2]);
    const additional = await createSubRequest({ ...base, submissionId: 'second-submission' });
    expect(additional.requests.map(request => request.slotsNeeded).sort()).toEqual([2, 4]);
  });

  test('rejects an invalid second pool before writing either need', async () => {
    await expect(createSubRequest({ ...base, needs: [base.needs[0]!, { pool: 'female', slotsNeeded: 0 }] })).rejects.toThrow('whole number');
    expect(snapshot('subLotteryRequests', []).docs).toHaveLength(0);
  });
});
