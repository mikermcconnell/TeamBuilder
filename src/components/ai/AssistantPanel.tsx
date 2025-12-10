import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { TeamSuggestion } from '@/types/ai';
import { SuggestionCard } from './SuggestionCard';

interface AssistantPanelProps {
    suggestions: TeamSuggestion[];
    isLoading: boolean;
    onSendPrompt: (prompt: string) => void;
    onAcceptSuggestion: (suggestion: TeamSuggestion) => void;
    onDismissSuggestion: (id: string) => void;
    onClose: () => void;
}

export function AssistantPanel({
    suggestions,
    isLoading,
    onSendPrompt,
    onAcceptSuggestion,
    onDismissSuggestion,
    onClose
}: AssistantPanelProps) {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            onSendPrompt(prompt);
            setPrompt('');
        }
    };

    return (
        <Card className="flex flex-col h-full border-l shadow-xl rounded-none w-[350px]">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <CardTitle className="text-sm font-semibold">Gemini Assistant</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                    <span className="sr-only">Close</span>
                    <XIcon className="h-4 w-4" />
                </Button>
            </CardHeader>

            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Suggestions Area */}
                <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                    {suggestions.length === 0 && !isLoading && (
                        <div className="text-center text-sm text-slate-500 mt-10 px-4">
                            <p>No active suggestions.</p>
                            <p className="mt-2 text-xs">
                                Ask me to help balance gender, skills, or handlers!
                            </p>
                        </div>
                    )}

                    {suggestions.map((suggestion) => (
                        <SuggestionCard
                            key={suggestion.id}
                            suggestion={suggestion}
                            onAccept={onAcceptSuggestion}
                            onDismiss={onDismissSuggestion}
                        />
                    ))}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center p-8 space-y-3">
                            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                            <span className="text-xs text-slate-500 font-medium">Analyzing potential moves...</span>
                        </div>
                    )}
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t bg-white">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="E.g., 'Make sure every team has 3 handlers'..."
                            className="text-sm focus-visible:ring-purple-500"
                            disabled={isLoading}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            className="bg-purple-600 hover:bg-purple-700 shrink-0"
                            disabled={isLoading || !prompt.trim()}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </Card>
    );
}

// Simple X icon helper
function XIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 18 18" />
        </svg>
    );
}
