import React from 'react';
import { SuggestedGroup } from '@/services/groupSuggestionService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Sparkles, Users, Loader2 } from 'lucide-react';

interface SuggestedGroupsPanelProps {
    suggestions: SuggestedGroup[];
    isLoading: boolean;
    onAccept: (suggestion: SuggestedGroup) => void;
    onDeny: (suggestionId: string) => void;
    onGenerate: () => void;
}

export function SuggestedGroupsPanel({
    suggestions,
    isLoading,
    onAccept,
    onDeny,
    onGenerate
}: SuggestedGroupsPanelProps) {
    const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
        switch (confidence) {
            case 'high': return 'bg-green-100 text-green-700 border-green-200';
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'low': return 'bg-orange-100 text-orange-700 border-orange-200';
        }
    };

    return (
        <Card className="border-2 border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base">AI-Suggested Groups</CardTitle>
                            <CardDescription className="text-xs">
                                Based on teammate requests and skill compatibility
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        onClick={onGenerate}
                        disabled={isLoading}
                        size="sm"
                        className="gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                Generate Suggestions
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>

            {suggestions.length > 0 && (
                <CardContent className="pt-0">
                    <div className="space-y-3">
                        {suggestions.map((suggestion) => (
                            <div
                                key={suggestion.id}
                                className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm"
                            >
                                {/* Group Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        <span className="font-semibold text-sm text-slate-700">
                                            {suggestion.playerNames.join(', ')}
                                        </span>
                                        <Badge variant="outline" className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}>
                                            {suggestion.confidence}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2">
                                        {suggestion.reasoning}
                                    </p>
                                    <div className="mt-1 text-xs text-slate-400">
                                        Avg Skill: <span className="font-medium text-slate-600">{suggestion.avgSkill.toFixed(1)}</span>
                                        {' • '}
                                        {suggestion.playerIds.length} players
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-1 shrink-0">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                        onClick={() => onAccept(suggestion)}
                                        title="Accept - Create Group"
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => onDeny(suggestion.id)}
                                        title="Dismiss Suggestion"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            )}

            {!isLoading && suggestions.length === 0 && (
                <CardContent className="pt-0">
                    <div className="text-center py-4 text-sm text-slate-400">
                        Click "Generate Suggestions" to analyze teammate requests
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
