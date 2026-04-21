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
    <div className={`rounded-xl border px-3 py-2 ${toneClasses[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-xl font-bold leading-none">{formatValue(metric.spread)}</div>
        <div className="text-[11px] opacity-70">
          Low {formatValue(metric.lowestAverage)} · High {formatValue(metric.highestAverage)}
        </div>
      </div>
    </div>
  );
}

export function TeamBoardSummary({ teams }: TeamBoardSummaryProps) {
  const summary = buildTeamSkillSpreadSummary(teams);

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardContent className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 lg:min-w-0">
            <div className="rounded-xl bg-slate-100 p-1.5 text-slate-600">
            <BarChart3 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Draft Summary</h2>
              <p className="text-xs text-slate-500">
                Skill spread across teams. Lower numbers mean tighter balance.
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3 lg:flex lg:flex-1 lg:justify-end">
            <SummaryMetric label="Overall skill spread" metric={summary.overall} tone="slate" />
            <SummaryMetric label="Male skill spread" metric={summary.male} tone="blue" />
            <SummaryMetric label="Female skill spread" metric={summary.female} tone="pink" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
