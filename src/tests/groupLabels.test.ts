import { describe, expect, it } from 'vitest';
import { getGroupLabelFromIndex, normalizeGroupLabel, sanitizeLegacyTeamName } from '@/utils/groupLabels';

describe('groupLabels', () => {
  it('builds spreadsheet-style labels after Z', () => {
    expect(getGroupLabelFromIndex(0)).toBe('A');
    expect(getGroupLabelFromIndex(25)).toBe('Z');
    expect(getGroupLabelFromIndex(26)).toBe('AA');
    expect(getGroupLabelFromIndex(27)).toBe('AB');
    expect(getGroupLabelFromIndex(31)).toBe('AF');
    expect(getGroupLabelFromIndex(59)).toBe('BH');
  });

  it('normalizes legacy single-character labels from old ASCII sequencing', () => {
    expect(normalizeGroupLabel('A')).toBe('A');
    expect(normalizeGroupLabel('[')).toBe('AA');
    expect(normalizeGroupLabel('\\')).toBe('AB');
    expect(normalizeGroupLabel(']')).toBe('AC');
    expect(normalizeGroupLabel('`')).toBe('AF');
    expect(normalizeGroupLabel('|')).toBe('BH');
  });

  it('sanitizes legacy team names that include old symbol labels', () => {
    expect(sanitizeLegacyTeamName('Group \\ Titans')).toBe('Group AB Titans');
    expect(sanitizeLegacyTeamName('Group ` Comets')).toBe('Group AF Comets');
    expect(sanitizeLegacyTeamName('Blue Waves')).toBe('Blue Waves');
  });
});
