import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { TeamSuggestion } from '@/types/ai';
import { SuggestionCard } from './SuggestionCard';
import { Player, Team } from '@/types';
import { cn } from '@/lib/utils';

interface AssistantPanelProps {
    suggestions: TeamSuggestion[];
    isLoading: boolean;
    onSendPrompt: (prompt: string) => void;
    onAcceptSuggestion: (suggestion: TeamSuggestion) => void;
    onDismissSuggestion: (id: string) => void;
    onClose: () => void;
    onReview: () => void;
    players: Player[];
    teams: Team[];
}

export function AssistantPanel({
    suggestions,
    isLoading,
    onSendPrompt,
    onAcceptSuggestion,
    onDismissSuggestion,
    onClose,
    onReview,
    players,
    teams
}: AssistantPanelProps) {
    const [prompt, setPrompt] = useState('');
    const [isOpen, setIsOpen] = useState(false); // Local toggle for the bubble

    // Auto-open if there are suggestions
    React.useEffect(() => {
        if (suggestions.length > 0) {
            setIsOpen(true);
        }
    }, [suggestions.length]);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
    };

    const resolvePlayerName = (id: string) => {
        const player = players.find(p => p.id === id);
        return player ? player.name : id;
    };

    const resolveTeamName = (id: string) => {
        const team = teams.find(t => t.id === id);
        return team ? team.name : id;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            onSendPrompt(prompt);
            setPrompt('');
        }
    };

    return (
        <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-50 pointer-events-none">

            {/* Speech Bubble / Main Panel */}
            <div className={cn(
                "pointer-events-auto transition-all duration-300 origin-bottom-right",
                isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4 pointer-events-none"
            )}>
                <Card className="w-[350px] shadow-2xl border-amber-200 bg-[#ffffe1] text-slate-900 overflow-hidden flex flex-col max-h-[600px]">
                    <CardHeader className="py-2 px-4 border-b border-amber-200 bg-amber-100/50 flex flex-row items-center justify-between">
                        <h3 className="font-bold text-sm text-amber-900">Clippy Tips</h3>
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-amber-200/50 rounded-full" onClick={() => setIsOpen(false)}>
                            <X className="h-3 w-3 text-amber-900" />
                        </Button>
                    </CardHeader>

                    <div className="flex-1 overflow-hidden flex flex-col relative">
                        {/* Triangle pointing to Clippy */}
                        <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#ffffe1] border-b border-r border-amber-200 rotate-45 transform z-20" />

                        <ScrollArea className="flex-1 p-4 bg-[#ffffe1]">
                            {/* Greeting if empty */}
                            {suggestions.length === 0 && !isLoading && (
                                <div className="text-sm text-slate-700 italic mb-4">
                                    "It looks like you're trying to build a team. Would you like some help with that?"
                                </div>
                            )}

                            {suggestions.length > 0 && (
                                <Button
                                    variant="outline"
                                    className="w-full mb-4 border-purple-200 text-purple-700 hover:bg-purple-50 bg-white"
                                    onClick={onReview}
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Review Suggestions
                                </Button>
                            )}

                            {suggestions.map((suggestion) => (
                                <SuggestionCard
                                    key={suggestion.id}
                                    suggestion={suggestion}
                                    onAccept={onAcceptSuggestion}
                                    onDismiss={onDismissSuggestion}
                                    resolvePlayerName={resolvePlayerName}
                                    resolveTeamName={resolveTeamName}
                                />
                            ))}

                            {isLoading && (
                                <div className="flex flex-col items-center justify-center p-8 space-y-3">
                                    <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                                    <span className="text-xs text-slate-500 font-medium">Thinking...</span>
                                </div>
                            )}
                        </ScrollArea>

                        <div className="p-3 bg-amber-50/50 border-t border-amber-200">
                            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Type your question here..."
                                    className="min-h-[40px] max-h-[120px] resize-none text-sm bg-white border-amber-200 focus-visible:ring-amber-400 py-2"
                                    disabled={isLoading}
                                    onInput={(e) => {
                                        const target = e.target as HTMLTextAreaElement;
                                        target.style.height = 'auto';
                                        target.style.height = `${target.scrollHeight}px`;
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            const form = e.currentTarget.closest('form');
                                            if (form) form.requestSubmit();
                                        }
                                    }}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    className="bg-amber-500 hover:bg-amber-600 text-white shrink-0 h-9 w-9"
                                    disabled={isLoading || !prompt.trim()}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Clippy Character / Toggle Button */}
            <div
                className="pointer-events-auto cursor-pointer hover:scale-110 transition-transform duration-200 relative group"
                onClick={toggleOpen}
            >
                {/* Notification Badge */}
                {suggestions.length > 0 && !isOpen && (
                    <span className="absolute 0 top-0 right-0 flex h-4 w-4 z-20">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">
                            {suggestions.length}
                        </span>
                    </span>
                )}

                <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden relative z-10">
                    <img
                        src="/clippy.jfif"
                        alt="Clippy"
                        className="w-full h-full object-cover scale-125 translate-y-2"
                    />
                </div>

                {/* Tooltip on hover */}
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Need help?
                </div>
            </div>

        </div>
    );
}
