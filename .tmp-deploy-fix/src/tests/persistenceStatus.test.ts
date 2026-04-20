import { describe, expect, it } from 'vitest';

import { describePersistenceStatus } from '@/hooks/useAppPersistence';

describe('describePersistenceStatus', () => {
  it('shows local-only guidance clearly when signed out', () => {
    expect(
      describePersistenceStatus(
        { phase: 'idle', scope: 'device', surface: 'local' },
        null,
        false
      )
    ).toEqual(
      expect.objectContaining({
        title: 'Not signed in',
        detail: 'Changes stay on this device',
      })
    );
  });

  it('shows cloud success when signed in and synced', () => {
    expect(
      describePersistenceStatus(
        { phase: 'saved', scope: 'project', surface: 'cloud' },
        { uid: 'user-1' } as never,
        true
      )
    ).toEqual(
      expect.objectContaining({
        title: 'Saved to cloud',
        detail: 'Project autosync is on',
      })
    );
  });

  it('shows retry messaging when cloud is unavailable', () => {
    expect(
      describePersistenceStatus(
        { phase: 'retrying', scope: 'project', surface: 'local' },
        { uid: 'user-1' } as never,
        true
      )
    ).toEqual(
      expect.objectContaining({
        title: 'Saved locally',
        detail: 'Cloud unavailable — retrying',
      })
    );
  });

  it('shows in-progress cloud saving state', () => {
    expect(
      describePersistenceStatus(
        { phase: 'saving', scope: 'project', surface: 'cloud' },
        { uid: 'user-1' } as never,
        true
      )
    ).toEqual(
      expect.objectContaining({
        title: 'Saving to cloud',
        detail: 'Syncing project now',
      })
    );
  });
});
