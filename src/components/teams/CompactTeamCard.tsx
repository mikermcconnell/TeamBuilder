import { CompactPlayerRow } from '@/components/teams/CompactPlayerRow';
import type { LeagueConfig, Team } from '@/types';

interface CompactTeamCardProps {
  team: Team;
  config: LeagueConfig;
}

export function CompactTeamCard({ team, config }: CompactTeamCardProps) {
  const handlerCount = team.handlerCount ?? team.players.filter((player) => player.isHandler).length;
  const teamColor = team.color ?? '#64748b';

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-2 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: teamColor }}
          />
          <h3 className="truncate text-sm font-bold leading-tight text-slate-900">{team.name}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          {team.players.length}/{config.maxTeamSize}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[11px] text-slate-600">
        <div className="rounded-md bg-white px-1 py-1 ring-1 ring-slate-100">
          <div className="font-bold text-slate-900">{team.averageSkill.toFixed(1)}</div>
          <div>Avg</div>
        </div>
        <div className="rounded-md bg-white px-1 py-1 ring-1 ring-slate-100">
          <div className="font-bold text-slate-900">{handlerCount}</div>
          <div>Handlers</div>
        </div>
        <div className="rounded-md bg-white px-1 py-1 ring-1 ring-slate-100">
          <div className="font-bold text-slate-900">M {team.genderBreakdown.M} / F {team.genderBreakdown.F}</div>
          <div>Gender</div>
        </div>
      </div>

      <div className="space-y-1">
        {team.players.map((player) => (
          <CompactPlayerRow key={player.id} player={player} />
        ))}
      </div>
    </section>
  );
}
