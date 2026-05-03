import { CompactTeamCard } from '@/components/teams/CompactTeamCard';
import { getEffectiveSkillRating, type LeagueConfig, type PlayerGroup, type Team } from '@/types';

interface BigBoardViewProps {
  teams: Team[];
  config: LeagueConfig;
  draftName?: string;
  playerGroups?: PlayerGroup[];
}

function formatNumber(value: number, decimals = 1): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '--';
}

function LeagueMetricsCard({ teams, playerGroups = [] }: { teams: Team[]; playerGroups?: PlayerGroup[] }) {
  const players = teams.flatMap((team) => team.players);
  const totalPlayers = players.length;
  const femaleCount = players.filter((player) => player.gender === 'F').length;
  const maleCount = players.filter((player) => player.gender === 'M').length;
  const otherCount = players.filter((player) => player.gender === 'Other').length;
  const handlerCount = players.filter((player) => player.isHandler).length;
  const newPlayerCount = players.filter((player) => player.isNewPlayer).length;
  const averageTeamSize = totalPlayers / Math.max(teams.length, 1);
  const teamAverages = teams.map((team) => {
    if (team.players.length === 0) return 0;
    return team.players.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0) / team.players.length;
  });
  const leagueAverage = players.length > 0
    ? players.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0) / players.length
    : 0;
  const averageVariation = teamAverages.length > 0
    ? teamAverages.reduce((sum, value) => sum + Math.abs(value - leagueAverage), 0) / teamAverages.length
    : 0;
  const skillRange = teamAverages.length > 0
    ? Math.max(...teamAverages) - Math.min(...teamAverages)
    : 0;

  const playerTeamById = new Map<string, string>();
  teams.forEach((team) => {
    team.players.forEach((player) => {
      playerTeamById.set(player.id, team.id);
    });
  });

  const accommodatedGroups = playerGroups.filter((group) => {
    if (group.playerIds.length <= 1) return false;
    const teamIds = group.playerIds.map((playerId) => playerTeamById.get(playerId));
    return teamIds.every(Boolean) && new Set(teamIds).size === 1;
  }).length;

  const totalGroups = playerGroups.filter((group) => group.playerIds.length > 1).length;
  const groupPct = totalGroups > 0 ? Math.round((accommodatedGroups / totalGroups) * 100) : 0;

  const metrics = [
    { label: 'Teams', value: teams.length },
    { label: 'Players', value: totalPlayers },
    { label: 'Females', value: femaleCount },
    { label: 'Males', value: maleCount },
    { label: 'Handlers', value: handlerCount },
    { label: 'New players', value: newPlayerCount },
    { label: 'Avg team size', value: formatNumber(averageTeamSize) },
    { label: 'League avg skill', value: formatNumber(leagueAverage) },
    { label: 'Avg team variation', value: `±${formatNumber(averageVariation)}` },
    { label: 'Skill range', value: formatNumber(skillRange) },
  ];

  if (otherCount > 0) {
    metrics.splice(4, 0, { label: 'Other', value: otherCount });
  }

  return (
    <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:col-span-2 2xl:col-span-2 min-[1800px]:col-span-2">
      <div className="mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">League metrics</p>
        <h2 className="text-sm font-bold text-slate-950">{teams.length}-team scenario snapshot</h2>
      </div>

      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold text-emerald-800">Groups accommodated</span>
          <span className="text-lg font-black text-emerald-900">{accommodatedGroups}/{totalGroups}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${groupPct}%` }} />
        </div>
        <p className="mt-1 text-[10px] font-semibold text-emerald-700">
          {totalGroups > 0 ? `${groupPct}% of requested groups kept together` : 'No requested groups in this scenario'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</div>
            <div className="text-base font-black leading-tight text-slate-950">{metric.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function BigBoardView({ teams, config, draftName, playerGroups }: BigBoardViewProps) {
  if (teams.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <p className="text-sm font-medium text-slate-500">No teams to show yet</p>
      </div>
    );
  }

  const maxFemaleRows = Math.max(0, ...teams.map((team) => team.players.filter((player) => player.gender === 'F').length));
  const maxMaleRows = Math.max(0, ...teams.map((team) => team.players.filter((player) => player.gender === 'M').length));

  return (
    <div className="min-h-0 flex-1 overflow-auto px-1 py-1">
      <h2 className="sr-only">{draftName || 'Current Scenario'}</h2>
      <div
        aria-label={draftName || 'Current Scenario'}
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7 min-[2600px]:grid-cols-8"
      >
        {teams.map((team) => (
          <CompactTeamCard
            key={team.id}
            team={team}
            config={config}
            maxFemaleRows={maxFemaleRows}
            maxMaleRows={maxMaleRows}
          />
        ))}
        <LeagueMetricsCard teams={teams} playerGroups={playerGroups} />
      </div>
    </div>
  );
}
