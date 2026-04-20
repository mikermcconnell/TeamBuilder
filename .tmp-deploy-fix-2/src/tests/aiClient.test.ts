import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  currentUser: null as null | { getIdToken: ReturnType<typeof vi.fn> },
}));

const getCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/config/firebase', () => ({
  auth: authMock,
}));

vi.mock('@/services/authService', () => ({
  getCurrentUser: getCurrentUserMock,
}));

import { fetchTeamDraft } from '@/services/aiClient';
import type { TeamDraftRequest } from '@/shared/ai-contracts';

describe('aiClient auth headers', () => {
  const payload: TeamDraftRequest = {
    players: [],
    config: {
      id: 'league-1',
      name: 'League',
      maxTeamSize: 7,
      minFemales: 1,
      minMales: 1,
      allowMixedGender: true,
    },
    playerGroups: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.currentUser = null;
    getCurrentUserMock.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        data: {
          teams: [],
          unassignedPlayerIds: [],
        },
      }),
    }));
  });

  it('waits for restored auth state before calling protected AI endpoints', async () => {
    const restoredUser = {
      getIdToken: vi.fn().mockResolvedValue('restored-token'),
    };
    getCurrentUserMock.mockResolvedValue(restoredUser);

    await fetchTeamDraft(payload);

    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(restoredUser.getIdToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/ai/team-draft', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer restored-token',
      }),
    }));
  });

  it('omits the auth header only when no user is available after auth restore', async () => {
    await fetchTeamDraft(payload);

    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/ai/team-draft', expect.objectContaining({
      method: 'POST',
      headers: expect.not.objectContaining({
        Authorization: expect.anything(),
      }),
    }));
  });
});
