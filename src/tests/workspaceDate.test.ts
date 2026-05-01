import { describe, expect, it } from 'vitest';

import { formatSavedWorkspaceUpdatedAt } from '@/utils/workspaceDate';

describe('formatSavedWorkspaceUpdatedAt', () => {
  it('includes both the saved date and time', () => {
    expect(formatSavedWorkspaceUpdatedAt('2026-05-01T15:32:00.000Z', 'en-US', 'UTC')).toBe('May 1, 2026, 3:32 PM');
  });

  it('handles missing or invalid saved dates', () => {
    expect(formatSavedWorkspaceUpdatedAt(null)).toBe('N/A');
    expect(formatSavedWorkspaceUpdatedAt('not-a-date')).toBe('N/A');
  });
});
