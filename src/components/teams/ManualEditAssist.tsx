import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, WandSparkles } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <div className="absolute right-6 top-24 z-30">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="gap-2 rounded-full border-slate-200 bg-white/95 shadow-lg backdrop-blur hover:bg-white"
          aria-label="Open manual edit assist"
        >
          <WandSparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Manual Edit Assist</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute right-6 top-24 z-30 w-[320px] space-y-3">
      <Card className="border-slate-200 bg-white/95 shadow-xl backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Manual Edit Assist</CardTitle>
              <CardDescription>
                {activePlayer
                  ? `While moving ${activePlayer.name}, these targets keep the draft in better shape.`
                  : 'Start dragging a player to see the best-fit landing spots.'}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Hide manual edit assist"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
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
