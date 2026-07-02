import { CompactPlayerRow } from '@/components/teams/CompactPlayerRow';
import { getEffectiveSkillRating, type LeagueConfig, type Player, type Team } from '@/types';
import { clampSkillRating, formatSkillRating, getSkillTone } from '@/utils/skillScale';

interface CompactTeamCardProps {
  team: Team;
  config: LeagueConfig;
  maxFemaleRows?: number;
  maxMaleRows?: number;
  leagueAverageSkill?: number;
}

function getCompactTeamName(name: string): string {
  return name.replace(/^Group\s+[A-Z0-9]+\s+/i, '');
}

function sortPlayersBySkillHighToLow(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const skillDifference = getEffectiveSkillRating(b) - getEffectiveSkillRating(a);
    return skillDifference || a.name.localeCompare(b.name);
  });
}

export function CompactTeamCard({ team, config, maxFemaleRows = 0, maxMaleRows = 0, leagueAverageSkill = 0 }: CompactTeamCardProps) {
  const handlerCount = team.handlerCount ?? team.players.filter((player) => player.isHandler).length;
  const teamColor = team.color ?? '#64748b';
  const compactTeamName = getCompactTeamName(team.name);
  const averageSkill = Number.isFinite(team.averageSkill) ? team.averageSkill : 0;
  const averageTone = getSkillTone(averageSkill);
  const teamSkillPercent = clampSkillRating(averageSkill) * 10;
  const leagueSkillPercent = clampSkillRating(leagueAverageSkill) * 10;
  const skillDelta = averageSkill - leagueAverageSkill;
  const skillDeltaText = Math.abs(skillDelta) < 0.05
    ? 'Even with league'
    : `${skillDelta > 0 ? '+' : ''}${skillDelta.toFixed(1)} vs league`;
  const femalePlayers = sortPlayersBySkillHighToLow(team.players.filter((player) => player.gender === 'F'));
  const malePlayers = sortPlayersBySkillHighToLow(team.players.filter((player) => player.gender === 'M'));
  const otherPlayers = sortPlayersBySkillHighToLow(team.players.filter((player) => player.gender !== 'F' && player.gender !== 'M'));

  const renderPlayerSection = (
    label: string,
    players: Player[],
    className: string,
    countClassName: string,
    rowCount: number
  ) => {
    if (rowCount === 0 && players.length === 0) return null;
    const blankRows = Math.max(0, rowCount - players.length);

    return (
      <div className="space-y-0.5">
        <div className={`flex items-center justify-between border-b px-1 pb-0 text-[9px] font-bold uppercase tracking-wider ${className}`}>
          <span>{label}</span>
          <span className={`rounded-full px-1.5 text-[8px] ${countClassName}`}>{players.length}</span>
        </div>
        <div className="space-y-1">
          {players.map((player) => (
            <CompactPlayerRow key={player.id} player={player} />
          ))}
          {Array.from({ length: blankRows }).map((_, index) => (
            <div
              key={`${label}-blank-${index}`}
              aria-hidden="true"
              className="h-[18px] rounded border border-transparent px-1 py-0"
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div aria-hidden="true" className="h-1" style={{ backgroundColor: teamColor }} />
      <div className="p-1.5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: teamColor }}
          />
          <h3 className="truncate text-[13px] font-bold leading-tight text-slate-900">{compactTeamName}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-white px-1.5 py-0 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
          {team.players.length}/{config.maxTeamSize}
        </span>
      </div>

      <div className="mb-1 grid grid-cols-3 gap-1 text-center text-[10px] text-slate-600">
        <div className="rounded-md bg-white px-1 py-0 ring-1 ring-slate-100">
          <div className="font-bold leading-tight text-slate-900">{team.averageSkill.toFixed(1)}</div>
          <div className="leading-tight">Avg</div>
        </div>
        <div className="rounded-md bg-white px-1 py-0 ring-1 ring-slate-100">
          <div className="font-bold leading-tight text-slate-900">{handlerCount}</div>
          <div className="leading-tight">Handlers</div>
        </div>
        <div className="rounded-md bg-white px-1 py-0 ring-1 ring-slate-100">
          <div className="font-bold leading-tight text-slate-900">M {team.genderBreakdown.M} / F {team.genderBreakdown.F}</div>
          <div className="leading-tight">Gender</div>
        </div>
      </div>

      <div
        aria-label={`${compactTeamName} skill balance versus league average`}
        className="mb-1 rounded-md border border-slate-100 bg-slate-50 px-1.5 py-1"
      >
        <div className="mb-0.5 flex items-center justify-between gap-2 text-[9px] font-semibold text-slate-600">
          <span>Skill balance</span>
          <span className="tabular-nums">{skillDeltaText}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-slate-200">
          <div
            className="h-full rounded-full"
            style={{
              width: `${teamSkillPercent}%`,
              backgroundColor: averageTone.backgroundColor,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-slate-950"
            style={{ left: `${leagueSkillPercent}%` }}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[8px] text-slate-500">
          <span>Team {formatSkillRating(averageSkill)}</span>
          <span>League {formatSkillRating(leagueAverageSkill)}</span>
        </div>
      </div>

      <div className="space-y-1">
        {renderPlayerSection(
          'Females',
          femalePlayers,
          'border-pink-100 text-pink-600',
          'bg-pink-100 text-pink-700',
          maxFemaleRows
        )}
        {renderPlayerSection(
          'Males',
          malePlayers,
          'border-blue-100 text-blue-600',
          'bg-blue-100 text-blue-700',
          maxMaleRows
        )}
        {renderPlayerSection(
          'Other',
          otherPlayers,
          'border-slate-100 text-slate-600',
          'bg-slate-100 text-slate-700',
          otherPlayers.length
        )}
      </div>
      </div>
    </section>
  );
}
