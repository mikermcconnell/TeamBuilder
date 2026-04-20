import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Player } from '@/types';
import type { IterationInsights, ManualMoveRecommendation } from '@/utils/teamInsights';

interface ManualEditAssistProps {
  activePlayer: Player | null;
  recommendations: ManualMoveRecommendation[];
  insights: IterationInsights | null;
}

export function ManualEditAssist({
  activePlayer,
  recommendations,
  insights,
}: ManualEditAssistProps) {
  return (
    <div className="absolute right-6 top-24 z-30 w-[320px] space-y-3">
      <Card className="border-slate-200 bg-white/95 shadow-xl backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manual Edit Assist</CardTitle>
          <CardDescription>
            {activePlayer
              ? `While moving ${activePlayer.name}, these targets keep the draft in better shape.`
              : 'Start dragging a player to see the best-fit landing spots.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {insights && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-700">Current draft score</div>
                <Badge variant="secondary">{insights.score.total}/100</Badge>
              </div>
              <div className="mt-2 text-sm text-slate-500">{insights.summary}</div>
            </div>
          )}

          {activePlayer && recommendations.length > 0 ? (
            recommendations.map(recommendation => (
              <div key={recommendation.targetTeamId} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-800">{recommendation.targetTeamName}</div>
                  <Badge className={recommendation.scoreDelta >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}>
                    {recommendation.scoreDelta >= 0 ? '+' : ''}{recommendation.scoreDelta}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {recommendation.helpsGenderBalance && <Badge variant="outline">helps gender balance</Badge>}
                  {recommendation.helpsHandlerBalance && <Badge variant="outline">helps handlers</Badge>}
                  {recommendation.reducesRepeatPairings && <Badge variant="outline">breaks repeats</Badge>}
                  <Badge variant="outline">next score {recommendation.nextScore}</Badge>
                </div>

                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {recommendation.reasons.slice(0, 3).map(reason => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Keep an eye on handler spread, elite-player stacking, and repeat teammates from league memory when making manual swaps.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
