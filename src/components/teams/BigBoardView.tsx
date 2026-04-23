import { CompactTeamCard } from '@/components/teams/CompactTeamCard';
import type { LeagueConfig, Team } from '@/types';

interface BigBoardViewProps {
  teams: Team[];
  config: LeagueConfig;
  draftName?: string;
}

export function BigBoardView({ teams, config, draftName }: BigBoardViewProps) {
  if (teams.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-medium text-slate-500">No teams to show yet</p>
      </div>
    );
  }

  const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);

  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Big Board</p>
          <h2 className="truncate text-lg font-bold text-slate-950">{draftName || 'Current Draft'}</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{teams.length} teams</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{totalPlayers} players</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7 min-[2600px]:grid-cols-8">
        {teams.map((team) => (
          <CompactTeamCard key={team.id} team={team} config={config} />
        ))}
      </div>
    </div>
  );
}
