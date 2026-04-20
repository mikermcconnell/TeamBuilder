import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { IterationInsights } from '@/utils/teamInsights';

interface IterationScoreCardProps {
  insights: IterationInsights;
  compact?: boolean;
}

function toneClass(score: number) {
  if (score >= 80) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (score >= 65) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return 'bg-rose-50 text-rose-700 border-rose-200';
}

export function IterationScoreCard({ insights, compact = false }: IterationScoreCardProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{insights.iterationName}</span>
          <Badge className={`border ${toneClass(insights.score.total)}`}>
            {insights.score.total}/100
          </Badge>
        </CardTitle>
        <CardDescription>{insights.summary}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Balance</div>
            <div className="mt-1 text-xl font-bold text-slate-800">{insights.score.balance}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chemistry</div>
            <div className="mt-1 text-xl font-bold text-slate-800">{insights.score.chemistry}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance</div>
            <div className="mt-1 text-xl font-bold text-slate-800">{insights.score.compliance}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">League Memory</div>
            <div className="mt-1 text-xl font-bold text-slate-800">{insights.score.continuity}</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-bold text-emerald-800">What is working</div>
            <ul className="mt-2 space-y-2 text-sm text-emerald-900">
              {insights.strengths.length > 0 ? (
                insights.strengths.slice(0, compact ? 2 : 4).map(item => (
                  <li key={item}>• {item}</li>
                ))
              ) : (
                <li>• No standout strengths yet.</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-bold text-amber-800">Watch list</div>
            <ul className="mt-2 space-y-2 text-sm text-amber-900">
              {insights.risks.length > 0 ? (
                insights.risks.slice(0, compact ? 2 : 4).map(item => (
                  <li key={item}>• {item}</li>
                ))
              ) : (
                <li>• No material risks detected.</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
