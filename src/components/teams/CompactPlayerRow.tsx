import type { Player } from '@/types';
import { getEffectiveSkillRating } from '@/types';
import { PlayerLabels } from '@/components/PlayerLabels';
import { formatSkillRating, getSkillTone } from '@/utils/skillScale';

interface CompactPlayerRowProps {
  player: Player;
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

export function CompactPlayerRow({ player }: CompactPlayerRowProps) {
  const effectiveSkill = getEffectiveSkillRating({
    ...player,
    execSkillRating: player.execSkillRating ?? null,
  });
  const skillTone = getSkillTone(effectiveSkill);

  return (
    <div className="flex min-w-0 items-center gap-1 rounded border border-slate-100 bg-white px-1 py-0 text-[11px] leading-[16px] text-slate-700">
      <span className="min-w-0 flex-1 truncate font-medium leading-[16px] text-slate-900">{player.name}</span>
      <PlayerLabels player={player} compact />
      <span className={badgeClass(player.gender === 'F' ? 'violet' : player.gender === 'M' ? 'blue' : 'slate')}>
        {player.gender}
      </span>
      {player.isHandler && <span className={badgeClass('amber')}>Handler</span>}
      {player.isNewPlayer && <span className={badgeClass('emerald')}>New</span>}
      <span className="sr-only">Exec {formatSkillRating(effectiveSkill)}</span>
      <span
        aria-hidden="true"
        className="w-6 shrink-0 rounded border px-1 py-0 text-center text-[9px] font-semibold leading-[14px] tabular-nums"
        style={{
          backgroundColor: skillTone.backgroundColor,
          borderColor: skillTone.borderColor,
          color: skillTone.textColor,
        }}
      >
        {skillTone.label}
      </span>
    </div>
  );
}
