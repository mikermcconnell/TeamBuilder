import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(() => ({ kind: 'collection' })),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({ kind: 'doc' })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value: number) => ({ kind: 'limit', value })),
  orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
  query: vi.fn((...args: unknown[]) => ({ kind: 'query', args })),
  Timestamp: {
    now: vi.fn(() => ({ kind: 'timestamp' })),
  },
  updateDoc: vi.fn(),
  where: vi.fn((field: string, op: string, value: unknown) => ({ kind: 'where', field, op, value })),
}));

const authMock = vi.hoisted(() => ({
  currentUser: { uid: 'owner-1' },
  onAuthStateChanged: vi.fn((callback: (user: unknown) => void) => {
    callback(authMock.currentUser);
    return () => undefined;
  }),
}));

vi.mock('@/config/firebase', () => ({
  auth: authMock,
  db: { kind: 'db' },
}));

vi.mock('firebase/firestore', () => firestoreMocks);

vi.mock('@/services/storageService', () => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
}));

import { getUserRosters } from '@/services/rosterService';
import { getUserTeams } from '@/services/teamsService';
import { getUserSessions, saveConfigPreset, saveSession } from '@/services/firestoreService';

describe('private collection guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.currentUser = { uid: 'owner-1' };
    authMock.onAuthStateChanged.mockImplementation((callback: (user: unknown) => void) => {
      callback(authMock.currentUser);
      return () => undefined;
    });
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] });
    firestoreMocks.addDoc.mockResolvedValue({ id: 'new-doc' });
  });

  it('blocks roster queries when the requested user id does not match the signed-in user', async () => {
    const result = await getUserRosters('someone-else');

    expect(result).toEqual([]);
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('blocks teams queries when the requested user id does not match the signed-in user', async () => {
    const result = await getUserTeams('someone-else');

    expect(result).toEqual([]);
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('blocks session queries when the requested user id does not match the signed-in user', async () => {
    const result = await getUserSessions('someone-else');

    expect(result).toEqual([]);
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
  });

  it('rejects saving a config preset for another user', async () => {
    await expect(saveConfigPreset('someone-else', {
      id: 'config-1',
      name: 'Test',
      maxTeamSize: 12,
      minFemales: 3,
      minMales: 3,
      allowMixedGender: true,
    })).rejects.toThrow('Failed to save configuration preset');

    expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
  });

  it('rejects saving a session for another user', async () => {
    await expect(saveSession({
      userId: 'someone-else',
      name: 'Private Session',
      players: [],
      teams: [],
      unassignedPlayers: [],
      playerGroups: [],
      config: {
        id: 'config-1',
        name: 'Test',
        maxTeamSize: 12,
        minFemales: 3,
        minMales: 3,
        allowMixedGender: true,
      },
    })).rejects.toThrow('Failed to save session');

    expect(firestoreMocks.addDoc).not.toHaveBeenCalled();
  });
});
