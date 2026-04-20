import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { LeagueConfig, LeagueMemoryEntry, TeamIteration } from '@/types';
import { buildIterationInsights, compareIterationInsights, type IterationInsights } from '@/utils/teamInsights';
import { IterationScoreCard } from './IterationScoreCard';

interface IterationComparisonPanelProps {
  iterations: TeamIteration[];
  activeIterationId: string | null;
  config: LeagueConfig;
  leagueMemory?: LeagueMemoryEntry[];
}

function MetricRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3 border-b border-slate-100 py-2 text-sm">
      <div className="font-medium text-slate-600">{label}</div>
      <div className="text-slate-800">{left}</div>
      <div className="text-slate-800">{right}</div>
    </div>
  );
}

function buildInsightsMap(
  iterations: TeamIteration[],
  config: LeagueConfig,
  leagueMemory: LeagueMemoryEntry[]
): Map<string, IterationInsights> {
  return new Map(
    iterations
      .filter(iteration => iteration.status === 'ready')
      .map(iteration => [iteration.id, buildIterationInsights(iteration, config, leagueMemory)])
  );
}

export function IterationComparisonPanel({
  iterations,
  activeIterationId,
  config,
  leagueMemory = [],
}: IterationComparisonPanelProps) {
  const readyIterations = useMemo(
    () => iterations.filter(iteration => iteration.status === 'ready'),
    [iterations]
  );
  const insightsByIterationId = useMemo(
    () => buildInsightsMap(readyIterations, config, leagueMemory),
    [config, leagueMemory, readyIterations]
  );

  const [leftIterationId, setLeftIterationId] = useState<string | null>(activeIterationId);
  const [rightIterationId, setRightIterationId] = useState<string | null>(readyIterations[1]?.id ?? readyIterations[0]?.id ?? null);

  useEffect(() => {
    if (!readyIterations.length) {
      setLeftIterationId(null);
      setRightIterationId(null);
      return;
    }

    if (!leftIterationId || !insightsByIterationId.has(leftIterationId)) {
      setLeftIterationId(activeIterationId && insightsByIterationId.has(activeIterationId)
        ? activeIterationId
        : readyIterations[0]?.id ?? null);
    }

    if (!rightIterationId || !insightsByIterationId.has(rightIterationId) || rightIterationId === leftIterationId) {
      const fallbackRight = readyIterations.find(iteration => iteration.id !== (activeIterationId ?? leftIterationId))?.id
        ?? readyIterations[0]?.id
        ?? null;
      setRightIterationId(fallbackRight);
    }
  }, [activeIterationId, insightsByIterationId, leftIterationId, readyIterations, rightIterationId]);

  if (readyIterations.length < 2 || !leftIterationId || !rightIterationId) {
    return null;
  }

  const leftInsights = insightsByIterationId.get(leftIterationId);
  const rightInsights = insightsByIterationId.get(rightIterationId);

  if (!leftInsights || !rightInsights) {
    return null;
  }

  const comparison = compareIterationInsights(leftInsights, rightInsights);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Side-by-Side Iteration Comparison</CardTitle>
        <CardDescription>
          Compare two draft tabs across scoring, balance, chemistry, and league-memory signals.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-500">Left side</div>
            <Select value={leftIterationId} onValueChange={setLeftIterationId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an iteration" />
              </SelectTrigger>
              <SelectContent>
                {readyIterations.map(iteration => (
                  <SelectItem key={iteration.id} value={iteration.id}>
                    {iteration.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <IterationScoreCard insights={leftInsights} compact />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-500">Right side</div>
            <Select value={rightIterationId} onValueChange={setRightIterationId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an iteration" />
              </SelectTrigger>
              <SelectContent>
                {readyIterations.map(iteration => (
                  <SelectItem key={iteration.id} value={iteration.id}>
                    {iteration.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <IterationScoreCard insights={rightInsights} compact />
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-bold text-indigo-900">Recommendation</div>
            {comparison.recommendedIterationId && (
              <Badge className="border border-indigo-200 bg-white text-indigo-700">
                {(comparison.recommendedIterationId === leftInsights.iterationId ? leftInsights.iterationName : rightInsights.iterationName)}
              </Badge>
            )}
          </div>
          <ul className="mt-3 space-y-2 text-sm text-indigo-950">
            {comparison.reasons.map(reason => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div>Metric</div>
            <div>{leftInsights.iterationName}</div>
            <div>{rightInsights.iterationName}</div>
          </div>
          <div className="mt-2">
            <MetricRow label="Draft score" left={`${leftInsights.score.total}/100`} right={`${rightInsights.score.total}/100`} />
            <MetricRow label="Skill spread" left={leftInsights.skillSpread.toFixed(2)} right={rightInsights.skillSpread.toFixed(2)} />
            <MetricRow label="Handler spread" left={leftInsights.handlerSpread.toString()} right={rightInsights.handlerSpread.toString()} />
            <MetricRow label="Avoid conflicts" left={leftInsights.avoidViolations.toString()} right={rightInsights.avoidViolations.toString()} />
            <MetricRow label="Elite stack flags" left={leftInsights.eliteStackedTeams.toString()} right={rightInsights.eliteStackedTeams.toString()} />
            <MetricRow label="Low-band stack flags" left={leftInsights.lowBandStackedTeams.toString()} right={rightInsights.lowBandStackedTeams.toString()} />
            <MetricRow label="Repeat pairings" left={leftInsights.repeatedPairings.toString()} right={rightInsights.repeatedPairings.toString()} />
            <MetricRow
              label="Request honour rate"
              left={leftInsights.requestHonourRate === null ? 'No requests' : `${leftInsights.requestHonourRate.toFixed(0)}%`}
              right={rightInsights.requestHonourRate === null ? 'No requests' : `${rightInsights.requestHonourRate.toFixed(0)}%`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
