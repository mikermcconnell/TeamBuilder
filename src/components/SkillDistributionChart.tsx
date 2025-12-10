import { useMemo, useState } from 'react';
import { Player, getEffectiveSkillRating } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart3, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface SkillDistributionChartProps {
  players: Player[];
}

interface DistributionData {
  skillLevel: number;
  actualPercentage: number;
  expectedPercentage: number;
  actualCount: number;
  expectedCount: number;
  difference: number;
  percentileDifference: number;
}

export function SkillDistributionChart({ players }: SkillDistributionChartProps) {
  const [isOpen, setIsOpen] = useState(false);

  const distributionData = useMemo(() => {
    if (players.length === 0) return [];

    // Get effective skill ratings
    const skills = players.map(player => getEffectiveSkillRating(player));

    // For percentile-based normal distribution, we'll use a standard normal distribution
    // where each skill level represents a percentile range
    const normalPercentiles = [
      2.3,   // Skill 1: Bottom 2.3% (very poor)
      4.4,   // Skill 2: 2.3-6.7%
      9.2,   // Skill 3: 6.7-15.9%
      15.0,  // Skill 4: 15.9-30.9%
      19.1,  // Skill 5: 30.9-50% (below average)
      19.1,  // Skill 6: 50-69.1% (above average)
      15.0,  // Skill 7: 69.1-84.1%
      9.2,   // Skill 8: 84.1-93.3%
      4.4,   // Skill 9: 93.3-97.7%
      2.3    // Skill 10: Top 2.3% (elite)
    ];

    // Create skill level buckets (1-10)
    const buckets: DistributionData[] = [];
    for (let i = 1; i <= 10; i++) {
      // Round near-.5 values? Standard round: X.5 -> X+1
      const actualCount = skills.filter(skill => Math.round(skill) === i).length;
      const actualPercentage = players.length > 0 ? (actualCount / players.length) * 100 : 0;

      const expectedPercentage = normalPercentiles[i - 1] ?? 0;
      const expectedCount = Math.round((expectedPercentage / 100) * players.length);

      const difference = actualCount - expectedCount;
      const percentileDifference = actualPercentage - expectedPercentage;

      buckets.push({
        skillLevel: i,
        actualPercentage,
        expectedPercentage,
        actualCount,
        expectedCount,
        difference,
        percentileDifference
      });
    }

    return buckets;
  }, [players]);

  const maxPercentage = Math.max(...distributionData.map(d => Math.max(d.actualPercentage, d.expectedPercentage)));
  const totalPlayers = players.length;

  if (totalPlayers === 0) {
    return (
      <Card className="w-full">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-3 h-auto">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm font-medium">Skill Distribution</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">No players to analyze</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </Card>
    );
  }

  const skills = players.map(player => getEffectiveSkillRating(player));
  const mean = skills.reduce((sum, skill) => sum + skill, 0) / skills.length;

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm font-medium">Skill Distribution Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {totalPlayers} players • Mean: {mean.toFixed(1)}
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <div className="space-y-3">
              {/* Chart */}
              <div className="relative pl-10 mt-6">
                <div className="grid grid-cols-10 gap-1 h-32">
                  {distributionData.map((data) => {
                    const actualHeight = maxPercentage > 0 ? (data.actualPercentage / maxPercentage) * 100 : 0;
                    const expectedHeight = maxPercentage > 0 ? (data.expectedPercentage / maxPercentage) * 100 : 0;
                    const labelBottom = Math.max(actualHeight, expectedHeight);

                    return (
                      <div key={data.skillLevel} className="flex flex-col justify-end h-full relative group">
                        {/* Expected (normal distribution) bar - Dashed Line Top */}
                        <div
                          className="w-full absolute bottom-0 border-x border-t-2 border-dashed border-slate-300 rounded-t-sm z-0"
                          style={{ height: `${expectedHeight}%` }}
                        />

                        {/* Actual percentage bar - Solid Fill */}
                        <div
                          className={`w-full absolute bottom-0 rounded-sm z-10 opacity-90 hover:opacity-100 transition-opacity ${(() => {
                            const diff = Math.abs(data.percentileDifference);
                            if (diff < 2) return 'bg-slate-600';
                            if (diff < 5) return 'bg-red-400';
                            if (diff < 10) return 'bg-red-600';
                            return 'bg-red-800';
                          })()}`}
                          style={{ height: `${actualHeight}%` }}
                        />

                        {/* Count Label */}
                        <div
                          className="absolute w-full text-center text-xs leading-tight font-bold transition-all z-20"
                          style={{ bottom: `calc(${labelBottom}% + 4px)` }}
                        >
                          <span className="text-slate-900">{data.actualCount}</span>
                          <span className="text-slate-400 mx-0.5">/</span>
                          <span className="text-slate-500">{data.expectedCount}</span>
                        </div>



                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                          <div>Skill {data.skillLevel}</div>
                          <div>Actual: {data.actualPercentage.toFixed(1)}% ({data.actualCount})</div>
                          <div>Expected: {data.expectedPercentage.toFixed(1)}% ({data.expectedCount})</div>
                          <div>Diff: {data.percentileDifference > 0 ? '+' : ''}{data.percentileDifference.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-32 flex flex-col justify-between text-xs text-gray-400 w-10 pr-2 text-right">
                  <span>{maxPercentage.toFixed(0)}%</span>
                  <span>{(maxPercentage / 2).toFixed(0)}%</span>
                  <span>0%</span>
                </div>

                {/* X-axis numbers */}
                <div className="grid grid-cols-10 gap-1 mt-2">
                  {distributionData.map((data) => (
                    <div key={data.skillLevel} className="text-center text-xs font-medium text-slate-600">
                      {data.skillLevel}
                    </div>
                  ))}
                </div>

                {/* X-axis Label */}
                <div className="text-center text-xs text-slate-500 font-medium mt-2">
                  Skill Rating
                </div>
              </div>

              {/* Distribution Quality Score */}
              <div className="text-center pt-4 border-t mt-2">
                <div className="text-xs text-gray-600">
                  Distribution Variance: {(() => {
                    const avgDeviation = distributionData.reduce((sum, d) => sum + Math.abs(d.percentileDifference), 0) / distributionData.length;
                    return avgDeviation.toFixed(1);
                  })()}% from normal
                </div>
              </div>
            </div>

            {/* Normalization Guidance */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Improve Distribution
              </div>
              <p className="mb-2">
                To achieve a more normalized distribution (bell curve), aim for:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs ml-1 text-slate-600">
                <li>Most players (approx. 40%) should be rated <strong>5-6</strong> (Average).</li>
                <li>Fewer players (approx. 30%) should be rated <strong>4 or 7</strong> (Below/Above Average).</li>
                <li>Even fewer (approx. 20%) should be rated <strong>3 or 8</strong>.</li>
                <li>Only exceptional cases (approx. 10%) should be rated <strong>1-2 or 9-10</strong>.</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card >
  );
}