import React, { useState, useMemo } from 'react';
import { StructuredWarning } from '@/types/StructuredWarning';
import { Player } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    Clock,
    UserMinus
} from 'lucide-react';
import { WarningWizardPanel } from './WarningWizardPanel';

interface WarningBannerProps {
    warnings: StructuredWarning[];
    players: Player[];
    onResolveWarning: (warning: StructuredWarning) => void;
    onDismissWarning: (warningId: string) => void;
    onDismissAll: () => void;
}

export function WarningBanner({
    warnings,
    players,
    onResolveWarning,
    onDismissWarning,
    onDismissAll
}: WarningBannerProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    // Count pending warnings by category - filter out 'info' warnings without player data
    const stats = useMemo(() => {
        // Only consider actionable warnings (those with playerName, not 'info' category)
        const actionable = warnings.filter(w => w.category !== 'info' && w.playerName);
        const pending = actionable.filter(w => w.status === 'pending');
        const resolved = actionable.filter(w => w.status === 'accepted');
        const dismissed = actionable.filter(w => w.status === 'rejected');

        // Count by category - include match-exact in review count
        const needsReview = pending.filter(w => w.category === 'match-review' || w.category === 'match-exact').length;
        const notFound = pending.filter(w => w.category === 'not-found').length;

        return {
            total: actionable.length,
            pending: pending.length,
            resolved: resolved.length,
            dismissed: dismissed.length,
            needsReview,
            notFound,
            done: resolved.length + dismissed.length
        };
    }, [warnings]);

    // Don't render if no warnings at all (never had any)
    if (warnings.length === 0) {
        return null;
    }

    // Show completed state with summary when all resolved
    if (stats.pending === 0) {
        return (
            <Card className="mb-4 border-green-200 bg-green-50/50">
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleTrigger asChild>
                        <CardHeader className="py-3 cursor-pointer hover:bg-green-100/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-green-700">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span className="font-medium">All {stats.total} warnings resolved</span>
                                    <span className="text-sm text-green-600">
                                        ({stats.resolved} confirmed, {stats.dismissed} ignored)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); onDismissAll(); }}
                                        className="text-green-600 hover:text-green-700"
                                    >
                                        Clear
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600">
                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="pt-0 pb-4">
                            <WarningWizardPanel
                                warnings={warnings}
                                players={players}
                                onResolveWarning={onResolveWarning}
                                onDismissWarning={onDismissWarning}
                                onDismissAll={onDismissAll}
                            />
                        </CardContent>
                    </CollapsibleContent>
                </Collapsible>
            </Card>
        );
    }

    return (
        <Card className="mb-4 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 px-4 cursor-pointer hover:bg-amber-100/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                                        Roster Warnings
                                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                            {stats.pending} to resolve
                                        </Badge>
                                    </CardTitle>
                                    <p className="text-sm text-amber-600 mt-0.5">
                                        Review player request matches before building teams
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Quick stats */}
                                <div className="hidden sm:flex items-center gap-3 text-xs">
                                    {stats.needsReview > 0 && (
                                        <div className="flex items-center gap-1 text-amber-600">
                                            <Clock className="h-3 w-3" />
                                            <span>{stats.needsReview} review</span>
                                        </div>
                                    )}
                                    {stats.notFound > 0 && (
                                        <div className="flex items-center gap-1 text-red-600">
                                            <UserMinus className="h-3 w-3" />
                                            <span>{stats.notFound} not found</span>
                                        </div>
                                    )}
                                    {stats.done > 0 && (
                                        <div className="flex items-center gap-1 text-green-600">
                                            <CheckCircle2 className="h-3 w-3" />
                                            <span>{stats.done} done</span>
                                        </div>
                                    )}
                                </div>

                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 px-4">
                        <WarningWizardPanel
                            warnings={warnings}
                            players={players}
                            onResolveWarning={onResolveWarning}
                            onDismissWarning={onDismissWarning}
                            onDismissAll={onDismissAll}
                        />
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
