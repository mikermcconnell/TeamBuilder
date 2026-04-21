import { BarChart3 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { Team } from '@/types';
import { buildTeamSkillSpreadSummary, type TeamSkillSpreadMetric } from '@/utils/teamSummary';

interface TeamBoardSummaryProps {
  teams: Team[];
}

function formatValue(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

function SummaryMetric({
  label,
  metric,
  tone,
}: {
  label: string;
  metric: TeamSkillSpreadMetric;
  tone: 'slate' | 'blue' | 'pink';
}) {
  const toneClasses = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    pink: 'border-pink-200 bg-pink-50 text-pink-900',
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-bold">{formatValue(metric.spread)}</div>
      <div className="mt-2 text-xs opacity-70">
        Low {formatValue(metric.lowestAverage)} · High {formatValue(metric.highestAverage)}
      </div>
    </div>
  );
}

export function TeamBoardSummary({ teams }: TeamBoardSummaryProps) {
  const summary = buildTeamSkillSpreadSummary(teams);

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-100 p-2 text-slate-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Draft Summary</h2>
            <p className="mt-1 text-sm text-slate-500">
              Skill spread across teams. Lower numbers mean tighter balance.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SummaryMetric label="Overall skill spread" metric={summary.overall} tone="slate" />
          <SummaryMetric label="Male skill spread" metric={summary.male} tone="blue" />
          <SummaryMetric label="Female skill spread" metric={summary.female} tone="pink" />
        </div>
      </CardContent>
    </Card>
  );
}
