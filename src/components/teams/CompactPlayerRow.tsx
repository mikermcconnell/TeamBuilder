import type { Player } from '@/types';
import { getEffectiveSkillRating } from '@/types';

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

  return `rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${tones[tone]}`;
}

export function CompactPlayerRow({ player }: CompactPlayerRowProps) {
  const hasExecRating = player.execSkillRating !== null && player.execSkillRating !== undefined;
  const effectiveSkill = getEffectiveSkillRating({
    ...player,
    execSkillRating: player.execSkillRating ?? null,
  });

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-100 bg-white px-2 py-1 text-xs text-slate-700">
      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{player.name}</span>
      <span className={badgeClass(player.gender === 'F' ? 'violet' : player.gender === 'M' ? 'blue' : 'slate')}>
        {player.gender}
      </span>
      <span className={badgeClass(hasExecRating ? 'emerald' : 'slate')}>
        {hasExecRating ? `Exec ${formatRating(player.execSkillRating)}` : `Skill ${formatRating(effectiveSkill)}`}
      </span>
      {player.isHandler && <span className={badgeClass('amber')}>Handler</span>}
      {player.isNewPlayer && <span className={badgeClass('emerald')}>New</span>}
    </div>
  );
}
