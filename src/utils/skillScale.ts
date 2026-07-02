export interface SkillTone {
  label: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

export function clampSkillRating(skill: number): number {
  if (!Number.isFinite(skill)) return 0;
  return Math.min(10, Math.max(0, skill));
}

export function formatSkillRating(skill: number): string {
  const clampedSkill = clampSkillRating(skill);
  return Number.isInteger(clampedSkill) ? String(clampedSkill) : clampedSkill.toFixed(1);
}

export function getSkillTone(skill: number): SkillTone {
  const clampedSkill = clampSkillRating(skill);
  const lightness = Math.round(88 - (clampedSkill / 10) * 62);
  const saturation = Math.round(50 + (clampedSkill / 10) * 24);
  const textColor = lightness <= 52 ? '#ffffff' : '#064e3b';

  return {
    label: formatSkillRating(clampedSkill),
    backgroundColor: `hsl(150 ${saturation}% ${lightness}%)`,
    borderColor: `hsl(150 ${saturation}% ${Math.max(20, lightness - 10)}%)`,
    textColor,
  };
}

export function getSkillScaleLegend(): SkillTone[] {
  return [1, 5, 10].map(getSkillTone);
}
