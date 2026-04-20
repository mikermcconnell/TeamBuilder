import { describe, expect, it } from 'vitest';

import type { StructuredWarning } from '@/types/StructuredWarning';
import { applyWarningResolutionToRequests, isAvoidWarning } from '@/utils/warningResolution';

const teammateWarning: StructuredWarning = {
  id: 'warning-1',
  category: 'not-found',
  message: 'Player "Alex Example": Teammate request "Bobb Example" not found. Did you mean "Bob Example"?',
  playerName: 'Alex Example',
  requestedName: 'Bobb Example',
  matchedName: 'Bob Example',
  confidence: 'low',
  status: 'pending',
};

describe('warningResolution', () => {
  it('appends the accepted teammate match when the original unresolved request was not stored', () => {
    expect(applyWarningResolutionToRequests([], teammateWarning, true)).toEqual(['Bob Example']);
  });

  it('replaces the prior matched name when a review choice is corrected', () => {
    expect(applyWarningResolutionToRequests(['Bob Example'], {
      ...teammateWarning,
      category: 'match-review',
      message: 'Player "Alex Example": Teammate request "Bobb Example" matched to "Bob Example" (Phonetic similarity) - please verify',
      matchedName: 'Robert Example',
    }, true)).toEqual(['Robert Example']);
  });

  it('detects avoid-request warnings so callers can update the right request list', () => {
    expect(isAvoidWarning({
      ...teammateWarning,
      message: 'Player "Alex Example": Avoid request "Bobb Example" not found. Did you mean "Bob Example"?',
    })).toBe(true);
  });
});
