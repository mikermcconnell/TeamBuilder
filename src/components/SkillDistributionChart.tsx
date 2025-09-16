import React, { useMemo, useState } from 'react';
import { Player, getEffectiveSkillRating } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

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
      const actualCount = skills.filter(skill => Math.round(skill) === i).length;
      const actualPercentage = players.length > 0 ? (actualCount / players.length) * 100 : 0;

      const expectedPercentage = normalPercentiles[i - 1];
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
  const variance = skills.reduce((sum, skill) => sum + Math.pow(skill - mean, 2), 0) / skills.length;
  const stdDev = Math.sqrt(variance);

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
          <div className="relative">
            <div className="grid grid-cols-10 gap-1 h-32">
              {distributionData.map((data) => {
                const actualHeight = maxPercentage > 0 ? (data.actualPercentage / maxPercentage) * 100 : 0;
                const expectedHeight = maxPercentage > 0 ? (data.expectedPercentage / maxPercentage) * 100 : 0;

                return (
                  <div key={data.skillLevel} className="flex flex-col justify-end h-full relative group">
                    {/* Expected (normal distribution) bar - background */}
                    <div
                      className="w-full bg-gray-200 border border-gray-300 rounded-sm opacity-60"
                      style={{ height: `${expectedHeight}%` }}
                    />

                    {/* Actual percentage bar - overlay */}
                    <div
                      className={`w-full absolute bottom-0 rounded-sm border ${
                        data.percentileDifference > 1
                          ? 'bg-blue-500 border-blue-600'
                          : data.percentileDifference < -1
                          ? 'bg-red-400 border-red-500'
                          : 'bg-green-500 border-green-600'
                      }`}
                      style={{ height: `${actualHeight}%` }}
                    />

                    {/* Skill level label */}
                    <div className="text-xs text-center mt-1 font-medium">
                      {data.skillLevel}
                    </div>

                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
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
            <div className="absolute left-0 top-0 h-32 flex flex-col justify-between text-xs text-gray-500 -ml-10">
              <span>{maxPercentage.toFixed(0)}%</span>
              <span>{(maxPercentage / 2).toFixed(0)}%</span>
              <span>0%</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-200 border border-gray-300 rounded-sm"></div>
              <span>Expected %</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 border border-blue-600 rounded-sm"></div>
              <span>Over-represented</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-400 border border-red-500 rounded-sm"></div>
              <span>Under-represented</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 border border-green-600 rounded-sm"></div>
              <span>Well-balanced</span>
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            {(() => {
              const overRepresented = distributionData.filter(d => d.percentileDifference > 1);
              const underRepresented = distributionData.filter(d => d.percentileDifference < -1);
              const balanced = distributionData.filter(d => Math.abs(d.percentileDifference) <= 1);

              const avgDeviation = distributionData.reduce((sum, d) => sum + Math.abs(d.percentileDifference), 0) / distributionData.length;

              return (
                <>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-600">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-xs font-medium">Over</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {overRepresented.length} levels
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-red-600">
                      <TrendingDown className="h-3 w-3" />
                      <span className="text-xs font-medium">Under</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {underRepresented.length} levels
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600">
                      <Minus className="h-3 w-3" />
                      <span className="text-xs font-medium">Balanced</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {balanced.length} levels
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Distribution Quality Score */}
          <div className="text-center pt-2 border-t">
            <div className="text-xs text-gray-600">
              Distribution Variance: {(() => {
                const avgDeviation = distributionData.reduce((sum, d) => sum + Math.abs(d.percentileDifference), 0) / distributionData.length;
                return avgDeviation.toFixed(1);
              })()}% from normal
            </div>
          </div>
        </div>
        </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}