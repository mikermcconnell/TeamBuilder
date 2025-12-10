import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { TeamSuggestion } from '@/types/ai';
import { Player, Team } from '@/types';
import { ArrowRight, Check, X, TrendingUp, Users, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuggestionReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    suggestions: TeamSuggestion[];
    onConfirm: (suggestion: TeamSuggestion) => void;
    players: Player[];
    teams: Team[];
}

export function SuggestionReviewModal({
    isOpen,
    onClose,
    suggestions,
    onConfirm,
    players,
    teams
}: SuggestionReviewModalProps) {
    const [selectedId, setSelectedId] = useState<string>(suggestions[0]?.id || '');

    // Ensure selectedId is valid when suggestions change
    React.useEffect(() => {
        if (suggestions.length > 0 && !suggestions.find(s => s.id === selectedId)) {
            setSelectedId(suggestions[0].id);
        }
    }, [suggestions, selectedId]);

    const selectedSuggestion = suggestions.find(s => s.id === selectedId);

    // Helper: Resolve Names
    const resolvePlayerName = (id: string) => players.find(p => p.id === id)?.name || id;
    const resolveTeamName = (id: string) => teams.find(t => t.id === id)?.name || (id === 'unassigned' ? 'Unassigned' : id);

    // Helper: Calculate Before/After Stats
    const impactAnalysis = useMemo(() => {
        if (!selectedSuggestion) return null;

        // Clone teams deeply to simulate changes
        const hypotheticalTeams = teams.map(t => ({
            ...t,
            players: [...t.players],
            averageSkill: t.averageSkill, // Assume strict update logic would recalculate these
            handlerCount: t.handlerCount || 0
        }));

        const affectedTeamIds = new Set<string>();

        // Apply actions
        selectedSuggestion.actions.forEach(action => {
            const player = players.find(p => p.id === action.playerId);
            if (!player) return;

            // Remove from source
            if (action.sourceTeamId && action.sourceTeamId !== 'unassigned') {
                const sourceTeam = hypotheticalTeams.find(t => t.id === action.sourceTeamId);
                if (sourceTeam) {
                    sourceTeam.players = sourceTeam.players.filter(p => p.id !== action.playerId);
                    affectedTeamIds.add(sourceTeam.id);
                }
            }

            // Add to target
            if (action.targetTeamId && action.targetTeamId !== 'unassigned') {
                const targetTeam = hypotheticalTeams.find(t => t.id === action.targetTeamId);
                if (targetTeam) {
                    targetTeam.players.push(player);
                    affectedTeamIds.add(targetTeam.id);
                }
            }
        });

        // Recalculate Stats for affected teams
        const changes = Array.from(affectedTeamIds).map(teamId => {
            const originalTeam = teams.find(t => t.id === teamId)!;
            const newTeam = hypotheticalTeams.find(t => t.id === teamId)!;

            // Recalc Metrics (Simplified)
            const calcAvg = (plist: Player[]) => {
                if (plist.length === 0) return 0;
                const sum = plist.reduce((acc, p) => acc + (p.execSkillRating ?? p.skillRating ?? 0), 0);
                return Number((sum / plist.length).toFixed(1));
            };
            const calcHandlers = (plist: Player[]) => plist.filter(p => p.isHandler).length;

            return {
                teamId,
                name: originalTeam.name,
                metrics: {
                    skill: { before: originalTeam.averageSkill, after: calcAvg(newTeam.players) },
                    handlers: { before: originalTeam.handlerCount || 0, after: calcHandlers(newTeam.players) },
                    size: { before: originalTeam.players.length, after: newTeam.players.length }
                }
            };
        });

        return changes;
    }, [selectedSuggestion, teams, players]);

    if (!suggestions.length) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50/50">
                    <DialogTitle className="flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-600" />
                        Refined Schedule Review
                    </DialogTitle>
                    <DialogDescription>
                        Clippy proposed {suggestions.length} optimizations. Review and apply.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* LEFT PANEL: Options List */}
                    <div className="w-1/3 border-r bg-slate-50 flex flex-col">
                        <div className="p-4 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Proposed Changes
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-3">
                                {suggestions.map((s, idx) => (
                                    <div
                                        key={s.id}
                                        onClick={() => setSelectedId(s.id)}
                                        className={cn(
                                            "cursor-pointer p-3 rounded-lg border transition-all hover:bg-white hover:shadow-sm",
                                            selectedId === s.id
                                                ? "bg-white border-purple-500 ring-1 ring-purple-500 shadow-md"
                                                : "bg-white/50 border-slate-200"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <Badge variant={selectedId === s.id ? "default" : "outline"} className={selectedId === s.id ? "bg-purple-600" : ""}>
                                                Option {idx + 1}
                                            </Badge>
                                            <span className="text-[10px] font-mono text-slate-400 uppercase">{s.type}</span>
                                        </div>
                                        <h4 className="text-sm font-medium text-slate-800 leading-tight mb-1">{s.title}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-2">{s.reasoning}</p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* RIGHT PANEL: Impact Preview */}
                    <div className="flex-1 bg-white flex flex-col">
                        <div className="p-6 border-b">
                            <h2 className="text-lg font-semibold text-slate-800 mb-4">Projected Performance</h2>

                            {/* Metrics Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                {impactAnalysis?.map(change => (
                                    <Card key={change.teamId} className="shadow-sm">
                                        <CardContent className="p-4">
                                            <div className="text-sm font-medium text-slate-500 mb-2">{change.name}</div>
                                            <div className="space-y-3">
                                                <MetricRow
                                                    label="Avg Skill"
                                                    before={change.metrics.skill.before}
                                                    after={change.metrics.skill.after}
                                                    icon={<Activity className="w-3 h-3" />}
                                                />
                                                <MetricRow
                                                    label="Handlers"
                                                    before={change.metrics.handlers.before}
                                                    after={change.metrics.handlers.after}
                                                    icon={<Users className="w-3 h-3" />}
                                                />
                                                <MetricRow
                                                    label="Roster Size"
                                                    before={change.metrics.size.before}
                                                    after={change.metrics.size.after}
                                                    inverse={false}
                                                    icon={<TrendingUp className="w-3 h-3" />}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-auto">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Action Details</h3>
                            <div className="space-y-2">
                                {selectedSuggestion?.actions.map((action, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-100 text-sm">
                                        <Badge variant="outline" className="bg-white">MOVE</Badge>
                                        <span className="font-medium">{resolvePlayerName(action.playerId)}</span>
                                        <span className="text-slate-400">from</span>
                                        <span className="text-slate-600">{resolveTeamName(action.sourceTeamId!)}</span>
                                        <ArrowRight className="w-4 h-4 text-purple-400" />
                                        <span className="font-semibold text-purple-700">{resolveTeamName(action.targetTeamId!)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-white">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                        onClick={() => selectedSuggestion && onConfirm(selectedSuggestion)}
                    >
                        <Check className="w-4 h-4" />
                        Apply Selected Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MetricRow({ label, before, after, icon, inverse = false }: { label: string, before: number, after: number, icon: React.ReactNode, inverse?: boolean }) {
    const diff = Number((after - before).toFixed(1));
    const isPositive = diff > 0;
    const isNeutral = diff === 0;

    // Color logic: Higher skill usually green, higher handlers usually green.
    // Ensure we handle neutral cases correctly.
    let colorClass = "text-slate-500";
    if (!isNeutral) {
        colorClass = (isPositive && !inverse) || (!isPositive && inverse) ? "text-green-600" : "text-amber-600";
    }

    return (
        <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
                {icon}
                <span>{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-slate-400 line-through">{before}</span>
                <ArrowRight className="w-3 h-3 text-slate-300" />
                <span className={cn("font-bold", colorClass)}>
                    {after}
                    {!isNeutral && <span className="ml-1 text-[10px]">({diff > 0 ? '+' : ''}{diff})</span>}
                </span>
            </div>
        </div>
    );
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
    );
}
