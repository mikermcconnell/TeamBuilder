import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StructuredWarning } from '@/types/StructuredWarning';
import { Player } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AlertTriangle,
    AlertCircle,
    Check,
    X,
    ChevronLeft,
    SkipForward,
    Edit3,
    CheckCircle2,
    ArrowRight,
    ArrowLeftRight
} from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface WarningWizardPanelProps {
    warnings: StructuredWarning[];
    players: Player[];
    onResolveWarning: (warning: StructuredWarning) => void;
    onDismissWarning: (warningId: string) => void;
    onDismissAll: () => void;
}

interface RequestImpact {
    type: 'mutual' | 'one-way' | 'creates-new';
    description: string;
    icon: React.ReactNode;
    colorClass: string;
    details?: string;
    existingGroup?: string;
}

export function WarningWizardPanel({
    warnings,
    players,
    onResolveWarning,
    onDismissWarning,
    onDismissAll
}: WarningWizardPanelProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [correctedValue, setCorrectedValue] = useState('');
    const [popoverOpen, setPopoverOpen] = useState(false);

    // Get all actionable warnings (filter out 'info' category which have no player data)
    // Sort: match-review first, then not-found
    const allActionableWarnings = useMemo(() => {
        const filtered = warnings.filter(w => w.category !== 'info' && w.playerName);
        return filtered.sort((a, b) => {
            // Priority order: match-review (0), match-exact (1), not-found (2)
            const priority = (category: string) => {
                if (category === 'match-review') return 0;
                if (category === 'match-exact') return 1;
                if (category === 'not-found') return 2;
                return 3;
            };
            return priority(a.category) - priority(b.category);
        });
    }, [warnings]);

    // Count pending for progress
    const pendingCount = useMemo(() =>
        allActionableWarnings.filter(w => w.status === 'pending').length,
        [allActionableWarnings]
    );

    const currentWarning = allActionableWarnings[currentIndex] || null;

    // Reset index if out of bounds
    useEffect(() => {
        if (currentIndex >= allActionableWarnings.length && allActionableWarnings.length > 0) {
            setCurrentIndex(Math.max(0, allActionableWarnings.length - 1));
        }
    }, [allActionableWarnings.length, currentIndex]);

    // Update corrected value when warning changes
    useEffect(() => {
        if (currentWarning) {
            setCorrectedValue(currentWarning.matchedName || '');
            setEditMode(false);
        }
    }, [currentWarning]);

    // Calculate request impact for the current warning
    const requestImpact = useMemo((): RequestImpact | null => {
        if (!currentWarning) return null;

        // Use the corrected value if user has edited it, otherwise use the original match
        const effectiveMatchedName = editMode && correctedValue.trim()
            ? correctedValue.trim()
            : currentWarning.matchedName;

        if (!effectiveMatchedName) return null;

        const requesterName = currentWarning.playerName;
        const targetName = effectiveMatchedName;

        // Find the requester and target players
        const requester = players.find(p => p.name === requesterName);
        const target = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());

        if (!requester || !target) {
            return {
                type: 'creates-new',
                description: 'Player not found in roster',
                icon: <AlertCircle className="h-4 w-4" />,
                colorClass: 'text-red-600 bg-red-50 border-red-200'
            };
        }

        // Check if target also requested the requester in their current teammateRequests
        const targetRequestsRequesterInData = target.teammateRequests.some(
            req => req.toLowerCase() === requesterName?.toLowerCase()
        );

        // ALSO check if there's a complementary warning where target requested requester
        // This handles the case where both requests are pending warnings
        const complementaryWarning = allActionableWarnings.find(w =>
            w.id !== currentWarning.id &&
            w.playerName?.toLowerCase() === targetName.toLowerCase() &&
            (w.matchedName?.toLowerCase() === requesterName?.toLowerCase() ||
                w.requestedName?.toLowerCase() === requesterName?.toLowerCase())
        );

        const isMutual = targetRequestsRequesterInData || !!complementaryWarning;

        // Check if target is already in a group
        const targetGroupId = target.groupId;
        const requesterGroupId = requester.groupId;

        // Check group sizes (for capacity limit messaging)
        const MAX_GROUP_SIZE = 4;
        const getGroupSize = (groupId: string | undefined): number => {
            if (!groupId) return 1;
            return players.filter(p => p.groupId === groupId).length;
        };

        const targetGroupSize = getGroupSize(targetGroupId);
        const requesterGroupSize = getGroupSize(requesterGroupId);

        if (isMutual) {
            // Mutual request!
            let details = `${target.name} also wants to play with ${requester.name}`;
            let existingGroup: string | undefined;

            // Check if they're already in the same group
            if (targetGroupId && requesterGroupId && targetGroupId === requesterGroupId) {
                existingGroup = 'Already in the same group';
                details = `Both players are already grouped together`;
            } else if (targetGroupId || requesterGroupId) {
                // Check group capacity
                if (targetGroupId && requesterGroupId) {
                    // Both are in groups - would need to merge
                    const combinedSize = targetGroupSize + requesterGroupSize;
                    if (combinedSize > MAX_GROUP_SIZE) {
                        details = `Cannot merge groups: combined size (${combinedSize}) exceeds max (${MAX_GROUP_SIZE})`;
                    } else {
                        details = 'Confirming may merge their groups';
                    }
                } else {
                    // One is in a group
                    const existingGroupSize = targetGroupId ? targetGroupSize : requesterGroupSize;
                    if (existingGroupSize >= MAX_GROUP_SIZE) {
                        details = `Cannot add to group: already at max size (${MAX_GROUP_SIZE})`;
                    } else {
                        details = `Will add to existing group (${existingGroupSize + 1}/${MAX_GROUP_SIZE})`;
                    }
                }
            } else {
                // Neither in a group - will create new
                details = 'Will create new group (2 players)';
            }

            // Add info if this was detected from another warning
            if (complementaryWarning && !targetRequestsRequesterInData) {
                details += ` (detected from another pending warning)`;
            }

            return {
                type: 'mutual',
                description: 'Mutual request',
                icon: <ArrowLeftRight className="h-4 w-4" />,
                colorClass: 'text-green-600 bg-green-50 border-green-200',
                details,
                existingGroup
            };
        }

        // One-way request
        let details = `Only ${requester.name} requested ${target.name}`;

        // Check if target requested someone else
        if (target.teammateRequests.length > 0) {
            const othersRequested = target.teammateRequests.join(', ');
            details = `${target.name} requested different players: ${othersRequested}`;
        }

        return {
            type: 'one-way',
            description: 'One-way request',
            icon: <ArrowRight className="h-4 w-4" />,
            colorClass: 'text-amber-600 bg-amber-50 border-amber-200',
            details
        };
    }, [currentWarning, players, allActionableWarnings, editMode, correctedValue]);

    // Find the next pending warning index (after the current one)
    const findNextPendingIndex = useCallback((startIndex: number): number | null => {
        for (let i = startIndex + 1; i < allActionableWarnings.length; i++) {
            if (allActionableWarnings[i]?.status === 'pending') {
                return i;
            }
        }
        // If no pending after current, search from beginning
        for (let i = 0; i < startIndex; i++) {
            if (allActionableWarnings[i]?.status === 'pending') {
                return i;
            }
        }
        return null;
    }, [allActionableWarnings]);

    // Handle confirm
    const handleConfirm = () => {
        if (!currentWarning) return;

        const finalName = editMode && correctedValue.trim()
            ? correctedValue.trim()
            : currentWarning.matchedName;

        onResolveWarning({
            ...currentWarning,
            matchedName: finalName,
            status: 'accepted'
        });

        setEditMode(false);

        // Auto-advance to next pending warning
        const nextIndex = findNextPendingIndex(currentIndex);
        if (nextIndex !== null) {
            setCurrentIndex(nextIndex);
        }
    };

    // Handle dismiss
    const handleDismiss = () => {
        if (!currentWarning) return;
        onDismissWarning(currentWarning.id);

        // Auto-advance to next pending warning
        const nextIndex = findNextPendingIndex(currentIndex);
        if (nextIndex !== null) {
            setCurrentIndex(nextIndex);
        }
    };

    // Handle previous
    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    // Handle next (for navigating through resolved warnings)
    const handleNext = () => {
        if (currentIndex < allActionableWarnings.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    // Handle skip all
    const handleSkipAll = () => {
        onDismissAll();
    };

    // Calculate summary statistics
    const summaryStats = useMemo(() => {
        const confirmed = allActionableWarnings.filter(w => w.status === 'accepted');
        const ignored = allActionableWarnings.filter(w => w.status === 'rejected');
        return { confirmed, ignored };
    }, [allActionableWarnings]);

    // Show summary when all warnings are resolved (no pending)
    if (pendingCount === 0 && allActionableWarnings.length > 0) {
        return (
            <div className="space-y-4">
                {/* Success header */}
                <div className="text-center py-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <p className="font-medium text-green-700">All warnings reviewed!</p>
                    <p className="text-sm text-green-600 mt-1">
                        {summaryStats.confirmed.length} confirmed · {summaryStats.ignored.length} ignored
                    </p>
                </div>

                {/* Summary of confirmed changes */}
                {summaryStats.confirmed.length > 0 && (
                    <Card>
                        <CardHeader className="py-3 bg-green-50">
                            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                                <Check className="h-4 w-4" />
                                Confirmed Matches ({summaryStats.confirmed.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="py-3 max-h-48 overflow-y-auto">
                            <div className="space-y-2">
                                {summaryStats.confirmed.map(w => (
                                    <div key={w.id} className="text-sm flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
                                        <span className="text-slate-600">{w.playerName}</span>
                                        <ArrowRight className="h-3 w-3 text-slate-400" />
                                        <span className="text-slate-500">"{w.requestedName}"</span>
                                        <ArrowRight className="h-3 w-3 text-green-500" />
                                        <span className="font-medium text-green-700">{w.matchedName}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Summary of ignored warnings */}
                {summaryStats.ignored.length > 0 && (
                    <Card>
                        <CardHeader className="py-3 bg-slate-50">
                            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                <X className="h-4 w-4" />
                                Ignored ({summaryStats.ignored.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="py-3 max-h-32 overflow-y-auto">
                            <div className="space-y-1">
                                {summaryStats.ignored.map(w => (
                                    <div key={w.id} className="text-sm text-slate-500 py-1 border-b border-slate-100 last:border-0">
                                        <span>{w.playerName}</span>
                                        <span className="mx-1">→</span>
                                        <span className="line-through">"{w.requestedName}"</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Option to review again */}
                <div className="flex justify-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentIndex(0)}
                        className="text-slate-600"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Review Changes
                    </Button>
                </div>
            </div>
        );
    }

    // No warnings at all
    if (allActionableWarnings.length === 0 || !currentWarning) {
        return (
            <div className="text-center py-4 text-green-600">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">No warnings to review!</p>
            </div>
        );
    }

    const isCurrentPending = currentWarning.status === 'pending';
    const isCurrentAccepted = currentWarning.status === 'accepted';
    const isCurrentRejected = currentWarning.status === 'rejected';

    const isNotFound = currentWarning.category === 'not-found';
    const knownPlayerNames = players.map(p => p.name);

    return (
        <div className="space-y-4">
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                    {currentIndex + 1} of {allActionableWarnings.length}
                    {pendingCount > 0 && <span className="text-amber-600 ml-1">({pendingCount} pending)</span>}
                    {pendingCount === 0 && <span className="text-green-600 ml-1">✓ All done</span>}
                </span>
                <div className="h-1.5 flex-1 mx-4 bg-slate-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${((allActionableWarnings.length - pendingCount) / allActionableWarnings.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Main wizard card */}
            <Card className={`border-2 ${isCurrentAccepted ? 'border-green-200' :
                isCurrentRejected ? 'border-slate-200' :
                    isNotFound ? 'border-red-200' : 'border-amber-200'
                }`}>
                <CardHeader className={`py-3 ${isCurrentAccepted ? 'bg-green-50' :
                    isCurrentRejected ? 'bg-slate-50' :
                        isNotFound ? 'bg-red-50' : 'bg-amber-50'
                    }`}>
                    <CardTitle className={`text-base flex items-center gap-2 ${isCurrentAccepted ? 'text-green-700' :
                        isCurrentRejected ? 'text-slate-500' :
                            isNotFound ? 'text-red-700' : 'text-amber-700'
                        }`}>
                        {isCurrentAccepted ? (
                            <><CheckCircle2 className="h-5 w-5" /> Confirmed Match</>
                        ) : isCurrentRejected ? (
                            <><X className="h-5 w-5" /> Ignored</>
                        ) : isNotFound ? (
                            <><AlertCircle className="h-5 w-5" /> Player Not Found</>
                        ) : (
                            <><AlertTriangle className="h-5 w-5" /> Review Match</>
                        )}
                    </CardTitle>
                </CardHeader>

                <CardContent className="py-4 space-y-4">
                    {/* Player making the request */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Player</span>
                            <div className="font-semibold text-lg">{currentWarning.playerName}</div>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Requested</span>
                            <div className={`font-medium text-lg ${isNotFound ? 'text-red-600' : 'text-amber-600'}`}>
                                "{currentWarning.requestedName}"
                            </div>
                        </div>
                    </div>

                    {/* Suggested match with edit capability */}
                    <div className="pt-3 border-t">
                        <span className="text-xs text-slate-500 uppercase tracking-wider">
                            {isNotFound ? 'Correct to:' : 'Matched to:'}
                        </span>

                        {editMode ? (
                            <div className="flex gap-2 mt-1">
                                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <div className="flex-1">
                                            <Input
                                                value={correctedValue}
                                                onChange={(e) => {
                                                    setCorrectedValue(e.target.value);
                                                    if (!popoverOpen) setPopoverOpen(true);
                                                }}
                                                onFocus={() => setPopoverOpen(true)}
                                                placeholder="Type player name..."
                                                className="w-full"
                                                autoFocus
                                            />
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="p-0 w-[var(--radix-popover-trigger-width)]"
                                        align="start"
                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                    >
                                        <Command>
                                            <CommandList>
                                                <CommandEmpty>No player found.</CommandEmpty>
                                                <CommandGroup heading="Suggestions">
                                                    {knownPlayerNames
                                                        .filter(name =>
                                                            !correctedValue ||
                                                            name.toLowerCase().includes(correctedValue.toLowerCase())
                                                        )
                                                        .slice(0, 5)
                                                        .map((name) => (
                                                            <CommandItem
                                                                key={name}
                                                                value={name}
                                                                onSelect={(val) => {
                                                                    setCorrectedValue(val);
                                                                    setPopoverOpen(false);
                                                                }}
                                                            >
                                                                {name}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEditMode(false);
                                        setCorrectedValue(currentWarning.matchedName || '');
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mt-1">
                                {currentWarning.matchedName ? (
                                    <span className="font-medium text-lg text-green-600">
                                        "{currentWarning.matchedName}"
                                    </span>
                                ) : (
                                    <span className="text-slate-400 italic">No suggestion</span>
                                )}
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700"
                                    title="Edit"
                                >
                                    <Edit3 className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {currentWarning.matchReason && !editMode && (
                            <div className="text-xs text-slate-500 mt-1">
                                ({currentWarning.matchReason})
                            </div>
                        )}
                    </div>

                    {/* Request Impact Preview - THE NEW FEATURE */}
                    {requestImpact && (
                        <div className={`mt-4 p-3 rounded-lg border ${requestImpact.colorClass}`}>
                            <div className="flex items-center gap-2 font-medium text-sm mb-1">
                                {requestImpact.icon}
                                <span>{requestImpact.description}</span>
                                {requestImpact.existingGroup && (
                                    <Badge variant="outline" className="text-xs ml-auto">
                                        {requestImpact.existingGroup}
                                    </Badge>
                                )}
                            </div>
                            {requestImpact.details && (
                                <p className="text-xs opacity-80 pl-6">{requestImpact.details}</p>
                            )}

                            {/* Visual relationship diagram */}
                            <div className="mt-3 pt-3 border-t border-current/10">
                                <div className="flex items-center justify-center gap-2 text-sm">
                                    <div className="px-3 py-1 rounded-full bg-white/50 font-medium">
                                        {currentWarning.playerName}
                                    </div>
                                    <div className="flex flex-col items-center">
                                        {requestImpact.type === 'mutual' ? (
                                            <ArrowLeftRight className="h-4 w-4" />
                                        ) : (
                                            <ArrowRight className="h-4 w-4" />
                                        )}
                                        <span className="text-[10px] opacity-70">
                                            {requestImpact.type === 'mutual' ? 'wants' : 'wants'}
                                        </span>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-white/50 font-medium">
                                        {editMode && correctedValue.trim() ? correctedValue.trim() : (currentWarning.matchedName || '?')}
                                    </div>
                                    {requestImpact.type === 'mutual' && (
                                        <Badge variant="default" className="ml-2 bg-green-600">
                                            ✓ Mutual
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex justify-between gap-2 py-3 bg-slate-50 border-t">
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            className="text-slate-600"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Back
                        </Button>
                        {!isCurrentPending && currentIndex < allActionableWarnings.length - 1 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleNext}
                                className="text-slate-600"
                            >
                                Next
                                <ChevronLeft className="h-4 w-4 ml-1 rotate-180" />
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {isCurrentPending && pendingCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSkipAll}
                                className="text-slate-500"
                            >
                                <SkipForward className="h-4 w-4 mr-1" />
                                Skip All
                            </Button>
                        )}

                        {isCurrentPending && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDismiss}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                                <X className="h-4 w-4 mr-1" />
                                Ignore
                            </Button>
                        )}

                        {!isCurrentPending && (
                            <Badge variant="outline" className={isCurrentAccepted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                                {isCurrentAccepted ? '✓ Confirmed' : 'Ignored'}
                            </Badge>
                        )}

                        <Button
                            size="sm"
                            onClick={handleConfirm}
                            disabled={editMode && !correctedValue.trim()}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Check className="h-4 w-4 mr-1" />
                            {isCurrentPending ? 'Confirm' : 'Re-confirm'}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
