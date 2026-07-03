import { Download, FileText, Globe2, ShieldCheck, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { summer2026ExecReview } from '@/data/summer2026ExecReview';

type ExecReviewReportData = typeof summer2026ExecReview;
type ExecReviewVariation = ExecReviewReportData['variations'][number];
type ExecReviewTeam = ExecReviewVariation['teams'][number];
type ExecReviewPlayer = ExecReviewTeam['roster'][number];

interface ExecReviewReportProps {
  report?: ExecReviewReportData;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function statusLabel(status: ExecReviewPlayer['newReturning']) {
  if (status === 'new') return 'New';
  if (status === 'returning') return 'Returning';
  return 'Unknown';
}

function ageLabel(ageBand: ExecReviewPlayer['ageBand']) {
  if (ageBand === 'young') return 'Young';
  if (ageBand === 'wise') return 'Wise';
  if (ageBand === 'standard') return 'Standard';
  return 'Unknown';
}

function leaderLabel(leaders: readonly string[]) {
  return leaders.length > 0 ? leaders.join(', ') : 'None';
}

function leaderBadges(player: ExecReviewPlayer) {
  return player.leaders.map(leader => {
    const isFemaleLeader = /\bfemale\b/i.test(leader);
    const isMaleLeader = /\bmale\b/i.test(leader);
    const isTierA = /\ba\b/i.test(leader);
    const isTierB = /\bb\b/i.test(leader);
    if (isFemaleLeader && isTierB) return { label: 'FL-B', className: 'bg-pink-100 text-pink-800 ring-pink-200' };
    if (isFemaleLeader) return { label: 'FL-A', className: 'bg-pink-100 text-pink-800 ring-pink-200' };
    if (isMaleLeader && isTierA) return { label: 'ML-A', className: 'bg-indigo-100 text-indigo-800 ring-indigo-200' };
    if (isMaleLeader && isTierB) return { label: 'ML-B', className: 'bg-blue-100 text-blue-800 ring-blue-200' };
    return { label: 'L', className: 'bg-slate-100 text-slate-700 ring-slate-200' };
  });
}

function groupLabelForPlayer(team: ExecReviewTeam, playerName: string) {
  const groupIndex = team.mustPlayGroups.findIndex(group => group.some(name => name === playerName));
  return groupIndex >= 0 ? `Group ${groupIndex + 1}` : null;
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ${className}`}>
      {children}
    </span>
  );
}

function PlayerRow({ player, team }: { player: ExecReviewPlayer; team: ExecReviewTeam }) {
  const groupLabel = groupLabelForPlayer(team, player.name);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-950">{player.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {groupLabel && <Pill className="bg-slate-100 text-slate-700 ring-slate-200">{groupLabel}</Pill>}
            {player.handler && <Pill className="bg-amber-100 text-amber-800 ring-amber-200">H</Pill>}
            {leaderBadges(player).map(badge => (
              <Pill key={`${player.name}-${badge.label}`} className={badge.className}>{badge.label}</Pill>
            ))}
            {player.newReturning === 'new' && <Pill className="bg-emerald-100 text-emerald-800 ring-emerald-200">New</Pill>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-black text-slate-600">{player.gender}</span>
          <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-black text-white">{player.skill.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

function GenderSection({ label, players, team, color }: { label: string; players: readonly ExecReviewPlayer[]; team: ExecReviewTeam; color: 'pink' | 'blue' }) {
  const colorClass = color === 'pink' ? 'text-pink-600 border-pink-100' : 'text-blue-600 border-blue-100';
  return (
    <section className="space-y-2">
      <div className={`flex items-center justify-between border-b pb-1 text-xs font-black uppercase tracking-[0.2em] ${colorClass}`}>
        <span>{label}</span>
        <span>{players.length}</span>
      </div>
      <div className="space-y-2">
        {players.map(player => <PlayerRow key={player.name} player={player} team={team} />)}
      </div>
    </section>
  );
}

function TeamSnapshotCard({ team }: { team: ExecReviewTeam }) {
  const women = team.roster.filter(player => player.gender === 'F');
  const men = team.roster.filter(player => player.gender === 'M');
  const other = team.roster.filter(player => player.gender !== 'F' && player.gender !== 'M');

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-emerald-200 bg-gradient-to-b from-emerald-50/80 via-white to-white shadow-sm ring-1 ring-emerald-100">
      <div className="h-1.5 bg-emerald-600" />
      <div className="space-y-5 p-5">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black text-slate-950">{team.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{team.size} players · Avg skill {team.averageSkill.toFixed(1)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm"><div className="text-[10px] font-black text-slate-500">F</div><div className="font-black text-slate-950">{team.female}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm"><div className="text-[10px] font-black text-slate-500">M</div><div className="font-black text-slate-950">{team.male}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm"><div className="text-[10px] font-black text-slate-500">H</div><div className="font-black text-slate-950">{team.handlers}</div></div>
          </div>
        </header>

        <GenderSection label="Women" players={women} team={team} color="pink" />
        <GenderSection label="Men" players={men} team={team} color="blue" />
        {other.length > 0 && <GenderSection label="Other" players={other} team={team} color="blue" />}
      </div>
    </article>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </div>
  );
}

function VariationSnapshot({ variation }: { variation: ExecReviewVariation }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-black text-slate-950">{variation.name}</h2>
          <p className="mt-1 text-sm text-slate-500">All 8 teams, all players, formatted for quick exec scanning.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-white">{variation.summary.niceHonored}/{variation.summary.niceTotal} nice honoured</Badge>
          <Badge variant="outline" className="bg-white">{variation.summary.femaleLeaderTeams}/8 teams have female leaders</Badge>
          <Badge variant="outline" className="bg-white">{variation.summary.maleLeaderCoveredTeams}/8 teams have male leaders</Badge>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
        {variation.teams.map(team => <TeamSnapshotCard key={`${variation.id}-${team.name}-snapshot`} team={team} />)}
      </div>
    </section>
  );
}

function TeamPlayerRows({ team }: { team: ExecReviewTeam }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{team.name}</CardTitle>
            <CardDescription>{team.size} players · {team.male}M/{team.female}F · Avg skill {team.averageSkill.toFixed(1)} · {team.handlers} handlers</CardDescription>
          </div>
          <Badge variant="outline">{team.niceRequestsHonored.length} nice honoured</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Handler</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.roster.map(player => (
                <TableRow key={player.name}>
                  <TableCell className="font-semibold">{player.name}</TableCell>
                  <TableCell>{player.gender}</TableCell>
                  <TableCell>{player.skill.toFixed(1)}</TableCell>
                  <TableCell>{player.handler ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{leaderLabel(player.leaders)}</TableCell>
                  <TableCell>{statusLabel(player.newReturning)}</TableCell>
                  <TableCell>{ageLabel(player.ageBand)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function VariationDetail({ variation }: { variation: ExecReviewVariation }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-5 w-5 text-slate-600" />
        <h2 className="text-2xl font-black text-slate-950">{variation.name} player details</h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {variation.teams.map(team => <TeamPlayerRows key={`${variation.id}-${team.name}-rows`} team={team} />)}
      </div>
    </section>
  );
}

export function ExecReviewReport({ report = summer2026ExecReview }: ExecReviewReportProps) {
  const leaderTotal = report.roster.femaleLeaders
    + report.roster.femaleLeaderB
    + report.roster.maleLeaderA
    + report.roster.maleLeaderB;

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-emerald-50/30 to-sky-50/40">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-sky-400 to-amber-300" />
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-4xl font-black text-slate-950">{report.seasonName} Team Options</CardTitle>
              <CardDescription className="mt-2 text-base">HTML is the main review format. The PDF is generated from the same styled report for sharing.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><a href="/reports/summer-outdoor-2026-exec-review.html" target="_blank" rel="noreferrer"><Globe2 className="mr-2 h-4 w-4" />HTML</a></Button>
              <Button asChild variant="outline"><a href="/reports/summer-outdoor-2026-exec-review.md" download><FileText className="mr-2 h-4 w-4" />Markdown</a></Button>
              <Button asChild><a href="/reports/summer-outdoor-2026-exec-review.pdf" download><Download className="mr-2 h-4 w-4" />PDF</a></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Players" value={report.roster.totalPlayers} detail={`${report.roster.male}M / ${report.roster.female}F`} />
            <MetricCard label="Teams" value={report.source.teamCount} detail="per variation" />
            <MetricCard label="Nice requests" value={report.roster.mutualNicePairs} detail="mutual requests counted" />
            <MetricCard label="Handlers" value={report.roster.handlers} detail="spread by team" />
            <MetricCard label="Leaders" value={leaderTotal} detail="female A/B + male leaders" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />Summary table</CardTitle>
          <CardDescription>Quick comparison of the four options.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead>Nice requests honoured</TableHead>
                  <TableHead>Gender balance</TableHead>
                  <TableHead>Skill spread</TableHead>
                  <TableHead>Handler spread</TableHead>
                  <TableHead>Female leaders</TableHead>
                  <TableHead>Male leaders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.variations.map(variation => (
                  <TableRow key={variation.id}>
                    <TableCell className="font-semibold">{variation.name}</TableCell>
                    <TableCell>{variation.summary.niceHonored}/{variation.summary.niceTotal} ({percent(variation.summary.niceRate)})</TableCell>
                    <TableCell>{variation.summary.maleSpread}M / {variation.summary.femaleSpread}F spread</TableCell>
                    <TableCell>{variation.summary.skillSpread.toFixed(2)}</TableCell>
                    <TableCell>{variation.summary.handlerSpread}</TableCell>
                    <TableCell>{variation.summary.femaleLeaderTeams}/8 teams have female leaders</TableCell>
                    <TableCell>{variation.summary.maleLeaderCoveredTeams}/8 teams have male leaders</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {report.variations.map(variation => <VariationSnapshot key={`${variation.id}-snapshot`} variation={variation} />)}
      {report.variations.map(variation => <VariationDetail key={`${variation.id}-details`} variation={variation} />)}
    </div>
  );
}
