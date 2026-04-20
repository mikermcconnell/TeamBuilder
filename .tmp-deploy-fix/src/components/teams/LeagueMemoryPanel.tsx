import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeagueMemoryEntry, TeamIteration } from '@/types';
import type { IterationInsights } from '@/utils/teamInsights';

interface LeagueMemoryPanelProps {
  activeIteration: TeamIteration | null;
  leagueMemory: LeagueMemoryEntry[];
  activeInsights?: IterationInsights | null;
  onSaveCurrent: () => void;
  onRemoveEntry: (entryId: string) => void;
}

export function LeagueMemoryPanel({
  activeIteration,
  leagueMemory,
  activeInsights,
  onSaveCurrent,
  onRemoveEntry,
}: LeagueMemoryPanelProps) {
  const latestEntries = useMemo(
    () => [...leagueMemory].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 5),
    [leagueMemory]
  );

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>League Memory</CardTitle>
        <CardDescription>
          Save past team snapshots so TeamBuilder can flag repeat teammate pairings.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-800">Current history signal</div>
              <div className="mt-1 text-sm text-slate-500">
                {activeInsights
                  ? `${activeInsights.repeatedPairings} repeat pairing${activeInsights.repeatedPairings === 1 ? '' : 's'} found across ${leagueMemory.length} saved season snapshot${leagueMemory.length === 1 ? '' : 's'}.`
                  : 'Save a snapshot once you are happy with a season so future drafts can avoid repeats.'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{leagueMemory.length} saved snapshot{leagueMemory.length === 1 ? '' : 's'}</Badge>
              <Button onClick={onSaveCurrent} disabled={!activeIteration || activeIteration.status !== 'ready'}>
                Save current teams
              </Button>
            </div>
          </div>
        </div>

        {latestEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No league memory saved yet. Save a finished season here so future drafts can spread familiar teammates around.
          </div>
        ) : (
          <div className="space-y-3">
            {latestEntries.map(entry => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{entry.title}</div>
                    <div className="text-sm text-slate-500">
                      Saved {new Date(entry.createdAt).toLocaleDateString()} • {entry.teams.length} teams
                    </div>
                    {entry.iterationName && (
                      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                        From {entry.iterationName}
                      </div>
                    )}
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => onRemoveEntry(entry.id)} className="text-slate-500">
                    Remove
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.teams.slice(0, 4).map(team => (
                    <Badge key={team.teamId} variant="outline">
                      {team.teamName} • {team.playerIds.length}
                    </Badge>
                  ))}
                  {entry.teams.length > 4 && (
                    <Badge variant="outline">+{entry.teams.length - 4} more</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
