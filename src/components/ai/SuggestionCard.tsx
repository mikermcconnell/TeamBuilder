import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TeamSuggestion } from '@/types/ai';
import { ArrowRight, Check, X } from 'lucide-react';

interface SuggestionCardProps {
    suggestion: TeamSuggestion;
    onAccept: (suggestion: TeamSuggestion) => void;
    onDismiss: (id: string) => void;
    resolvePlayerName: (id: string) => string;
    resolveTeamName: (id: string) => string;
}

export function SuggestionCard({
    suggestion,
    onAccept,
    onDismiss,
    resolvePlayerName,
    resolveTeamName
}: SuggestionCardProps) {
    return (
        <Card className="mb-3 border-l-4 border-l-purple-500 shadow-sm">
            <CardContent className="pt-4 pb-2">
                <div className="flex justify-between items-start gap-2 mb-2">
                    <h4 className="font-semibold text-sm leading-tight text-slate-800">
                        {suggestion.title}
                    </h4>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                        {suggestion.type}
                    </Badge>
                </div>

                <p className="text-xs text-slate-500 mb-3 italic">
                    "{suggestion.reasoning}"
                </p>

                <div className="space-y-2">
                    {suggestion.actions.map((action, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="font-medium text-slate-700">{resolvePlayerName(action.playerId)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-600">
                                {action.targetTeamId === 'unassigned' ? 'Unassigned' : resolveTeamName(action.targetTeamId)}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-2 pb-3 px-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-500 hover:text-slate-700"
                    onClick={() => onDismiss(suggestion.id)}
                >
                    <X className="w-3 h-3 mr-1" />
                    Dismiss
                </Button>
                <Button
                    size="sm"
                    className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => onAccept(suggestion)}
                >
                    <Check className="w-3 h-3 mr-1" />
                    Accept
                </Button>
            </CardFooter>
        </Card>
    );
}
