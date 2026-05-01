import { CompactPlayerRow } from '@/components/teams/CompactPlayerRow';
import type { LeagueConfig, Player, Team } from '@/types';

interface CompactTeamCardProps {
  team: Team;
  config: LeagueConfig;
}

function getCompactTeamName(name: string): string {
  return name.replace(/^Group\s+[A-Z0-9]+\s+/i, '');
}

export function CompactTeamCard({ team, config }: CompactTeamCardProps) {
  const handlerCount = team.handlerCount ?? team.players.filter((player) => player.isHandler).length;
  const teamColor = team.color ?? '#64748b';
  const compactTeamName = getCompactTeamName(team.name);
  const femalePlayers = team.players.filter((player) => player.gender === 'F');
  const malePlayers = team.players.filter((player) => player.gender === 'M');
  const otherPlayers = team.players.filter((player) => player.gender !== 'F' && player.gender !== 'M');

  const renderPlayerSection = (
    label: string,
    players: Player[],
    className: string,
    countClassName: string
  ) => {
    if (players.length === 0) return null;

    return (
      <div className="space-y-1">
        <div className={`flex items-center justify-between border-b px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}>
          <span>{label}</span>
          <span className={`rounded-full px-1.5 text-[9px] ${countClassName}`}>{players.length}</span>
        </div>
        <div className="space-y-1">
          {players.map((player) => (
            <CompactPlayerRow key={player.id} player={player} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/80 p-1.5 shadow-sm">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: teamColor }}
          />
          <h3 className="truncate text-sm font-bold leading-tight text-slate-900">{compactTeamName}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          {team.players.length}/{config.maxTeamSize}
        </span>
      </div>

      <div className="mb-1.5 grid grid-cols-3 gap-1 text-center text-[11px] text-slate-600">
        <div className="rounded-md bg-white px-1 py-0.5 ring-1 ring-slate-100">
          <div className="font-bold text-slate-900">{team.averageSkill.toFixed(1)}</div>
          <div>Avg</div>
        </div>
        <div className="rounded-md bg-white px-1 py-0.5 ring-1 ring-slate-100">
          <div className="font-bold text-slate-900">{handlerCount}</div>
          <div>Handlers</div>
        </div>
        <div className="rounded-md bg-white px-1 py-0.5 ring-1 ring-slate-100">
          <div className="font-bold text-slate-900">M {team.genderBreakdown.M} / F {team.genderBreakdown.F}</div>
          <div>Gender</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {renderPlayerSection(
          'Females',
          femalePlayers,
          'border-pink-100 text-pink-600',
          'bg-pink-100 text-pink-700'
        )}
        {renderPlayerSection(
          'Males',
          malePlayers,
          'border-blue-100 text-blue-600',
          'bg-blue-100 text-blue-700'
        )}
        {renderPlayerSection(
          'Other',
          otherPlayers,
          'border-slate-100 text-slate-600',
          'bg-slate-100 text-slate-700'
        )}
      </div>
    </section>
  );
}
