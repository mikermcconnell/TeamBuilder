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

  return (
    <div className="min-h-0 flex-1 overflow-auto px-1 py-1">
      <h2 className="sr-only">{draftName || 'Current Draft'}</h2>
      <div
        aria-label={draftName || 'Current Draft'}
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7 min-[2600px]:grid-cols-8"
      >
        {teams.map((team) => (
          <CompactTeamCard key={team.id} team={team} config={config} />
        ))}
      </div>
    </div>
  );
}
