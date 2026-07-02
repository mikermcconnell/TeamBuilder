import { describe, expect, it } from 'vitest';

import { getSkillScaleLegend, getSkillTone } from '@/utils/skillScale';

function extractLightness(hsl: string): number {
  const match = hsl.match(/(\d+(?:\.\d+)?)%\)$/);
  if (!match) {
    throw new Error(`Could not read lightness from ${hsl}`);
  }

  return Number(match[1]);
}

describe('skillScale', () => {
  it('maps higher skill ratings to darker tones than lower skill ratings', () => {
    const lowSkill = getSkillTone(2);
    const highSkill = getSkillTone(9);

    expect(extractLightness(highSkill.backgroundColor)).toBeLessThan(
      extractLightness(lowSkill.backgroundColor)
    );
    expect(highSkill.textColor).toBe('#ffffff');
    expect(lowSkill.label).toBe('2');
  });

  it('provides legend stops from low to high skill', () => {
    const legend = getSkillScaleLegend();

    expect(legend.map((stop) => stop.label)).toEqual(['1', '5', '10']);
    expect(extractLightness(legend[2].backgroundColor)).toBeLessThan(
      extractLightness(legend[0].backgroundColor)
    );
  });
});
