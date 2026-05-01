import type { Player } from '@/types';
import { getEffectiveSkillRating } from '@/types';
import { PlayerLabels } from '@/components/PlayerLabels';

interface CompactPlayerRowProps {
  player: Player;
}

function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

function badgeClass(tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'violet') {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  } as const;

  return `rounded border px-1 py-0 text-[9px] font-semibold leading-none ${tones[tone]}`;
}

function skillBadgeClass(skill: number): string {
  const roundedSkill = Math.round(skill);
  if (roundedSkill >= 10) return 'bg-green-900 text-green-50 border-green-800';
  if (roundedSkill === 9) return 'bg-green-800 text-green-50 border-green-700';
  if (roundedSkill === 8) return 'bg-green-700 text-green-50 border-green-600';
  if (roundedSkill === 7) return 'bg-green-600 text-green-50 border-green-500';
  if (roundedSkill === 6) return 'bg-green-500 text-green-50 border-green-400';
  if (roundedSkill === 5) return 'bg-green-400 text-green-900 border-green-300';
  if (roundedSkill === 4) return 'bg-green-300 text-green-900 border-green-200';
  if (roundedSkill === 3) return 'bg-green-200 text-green-900 border-green-200';
  if (roundedSkill === 2) return 'bg-green-100 text-green-800 border-green-200';
  if (roundedSkill === 1) return 'bg-green-50 text-green-800 border-green-100';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

export function CompactPlayerRow({ player }: CompactPlayerRowProps) {
  const effectiveSkill = getEffectiveSkillRating({
    ...player,
    execSkillRating: player.execSkillRating ?? null,
  });

  return (
    <div className="flex min-w-0 items-center gap-1 rounded border border-slate-100 bg-white px-1 py-0 text-[11px] leading-[16px] text-slate-700">
      <span className="min-w-0 flex-1 truncate font-medium leading-[16px] text-slate-900">{player.name}</span>
      <PlayerLabels player={player} compact />
      <span className={badgeClass(player.gender === 'F' ? 'violet' : player.gender === 'M' ? 'blue' : 'slate')}>
        {player.gender}
      </span>
      {player.isHandler && <span className={badgeClass('amber')}>Handler</span>}
      {player.isNewPlayer && <span className={badgeClass('emerald')}>New</span>}
      <span className="sr-only">Exec {formatRating(effectiveSkill)}</span>
      <span aria-hidden="true" className={`w-6 shrink-0 rounded border px-1 py-0 text-center text-[9px] font-semibold leading-[14px] tabular-nums ${skillBadgeClass(effectiveSkill)}`}>
        {formatRating(effectiveSkill)}
      </span>
    </div>
  );
}
