import React, { useMemo, useState, useEffect } from 'react';
import { StructuredWarning, WarningCategory, parseWarnings } from '@/types/StructuredWarning';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    AlertTriangle,
    Check,
    X,
    Info,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    SkipForward,
    Edit3,
    CheckIcon,
    ChevronsUpDown
} from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface WarningPanelProps {
    warnings: string[];
    onNavigateToRoster?: () => void;
    onConfirmLoad: () => void;
    knownPlayerNames?: string[];
}

interface WarningGroup {
    category: WarningCategory;
    label: string;
    icon: React.ReactNode;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    defaultOpen: boolean;
}

const WARNING_GROUPS: WarningGroup[] = [
    {
        category: 'match-exact',
        label: 'Auto-Resolved (Exact Matches)',
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        colorClass: 'text-green-700',
        bgClass: 'bg-green-50',
        borderClass: 'border-green-200',
        defaultOpen: false
    },
    {
        category: 'match-review',
        label: 'Needs Review',
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
        colorClass: 'text-amber-700',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        defaultOpen: true
    },
    {
        category: 'not-found',
        label: 'Not Found',
        icon: <AlertCircle className="h-4 w-4 text-red-600" />,
        colorClass: 'text-red-700',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        defaultOpen: true
    },
    {
        category: 'info',
        label: 'Info',
        icon: <Info className="h-4 w-4 text-blue-600" />,
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50',
        borderClass: 'border-blue-200',
        defaultOpen: false
    }
];

// Wizard card for reviewing a single warning
interface WarningWizardCardProps {
    warning: StructuredWarning;
    currentIndex: number;
    totalCount: number;
    onConfirm: (id: string, correctedValue?: string) => void;
    onIgnore: (id: string) => void;
    onPrevious: () => void;
    onSkipAll: () => void;
    onConfirmAll: (id: string, correctedValue?: string) => void;
    duplicateCount: number;
    knownPlayerNames: string[];
}

function WarningWizardCard({
    warning,
    currentIndex,
    totalCount,
    onConfirm,
    onIgnore,
    onPrevious,
    onSkipAll,
    onConfirmAll,
    duplicateCount,
    knownPlayerNames
}: WarningWizardCardProps) {
    const [editMode, setEditMode] = useState(false);
    const [correctedValue, setCorrectedValue] = useState(warning.matchedName || '');
    const [open, setOpen] = useState(false);

    const isNotFound = warning.category === 'not-found';

    // Update local state when warning changes
    useEffect(() => {
        setCorrectedValue(warning.matchedName || '');
        setEditMode(false); // Reset edit mode when warning changes
    }, [warning]);

    const getCorrectedValue = () => correctedValue.trim() || warning.matchedName;

    const handleConfirm = () => {
        const val = getCorrectedValue();
        if (val) {
            onConfirm(warning.id, val);
        }
        setEditMode(false);
    };

    const handleConfirmAll = () => {
        const val = getCorrectedValue();
        if (val) {
            onConfirmAll(warning.id, val);
        }
        setEditMode(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                handleConfirmAll();
            } else {
                handleConfirm();
            }
        } else if (e.key === 'Escape') {
            if (open) {
                setOpen(false);
            } else if (editMode) {
                setEditMode(false);
            } else {
                onIgnore(warning.id);
            }
        }
    };

    const handleIgnore = () => {
        onIgnore(warning.id);
        setEditMode(false);
    };

    return (
        <Card className={`w-full max-w-lg mx-auto shadow-lg ${isNotFound ? 'border-red-300' : 'border-amber-300'
            }`}>
            <CardHeader className={`py-3 ${isNotFound ? 'bg-red-50' : 'bg-amber-50'}`}>
                <div className="flex items-center justify-between">
                    <CardTitle className={`text-base flex items-center gap-2 ${isNotFound ? 'text-red-700' : 'text-amber-700'
                        }`}>
                        {isNotFound ? (
                            <AlertCircle className="h-5 w-5" />
                        ) : (
                            <AlertTriangle className="h-5 w-5" />
                        )}
                        {isNotFound ? 'Player Not Found' : 'Review Match'}
                    </CardTitle>
                    <span className="text-sm text-slate-500">
                        {currentIndex + 1} of {totalCount}
                    </span>
                </div>
            </CardHeader>

            <CardContent className="py-4 space-y-4">
                {/* Player making the request */}
                <div>
                    <span className="text-sm text-slate-500">Player:</span>
                    <div className="font-semibold text-lg">{warning.playerName}</div>
                </div>

                {/* What they requested */}
                <div>
                    <span className="text-sm text-slate-500">Requested teammate:</span>
                    <div className={`font-medium text-lg ${isNotFound ? 'text-red-600' : 'text-amber-600'}`}>
                        "{warning.requestedName}"
                    </div>
                </div>

                {/* Suggested match or input for correction */}
                {(warning.matchedName || isNotFound) && (
                    <div className="pt-2 border-t">
                        <span className="text-sm text-slate-500">
                            {isNotFound ? 'Correct name:' : 'Matched to:'}
                        </span>

                        {editMode ? (
                            <div className="flex gap-2 mt-1">
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <div className="flex-1 relative">
                                            <Input
                                                value={correctedValue}
                                                onChange={(e) => {
                                                    setCorrectedValue(e.target.value);
                                                    if (!open) setOpen(true);
                                                }}
                                                onFocus={() => setOpen(true)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Enter correct name..."
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
                                                        .map((name) => {
                                                            // Simple highlight logic
                                                            const matchIndex = name.toLowerCase().indexOf(correctedValue.toLowerCase());
                                                            const matchLength = correctedValue.length;

                                                            return (
                                                                <CommandItem
                                                                    key={name}
                                                                    value={name}
                                                                    onSelect={(currentValue) => {
                                                                        setCorrectedValue(currentValue);
                                                                        setOpen(false);
                                                                    }}
                                                                >
                                                                    <CheckIcon
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            correctedValue === name ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {matchIndex >= 0 && correctedValue ? (
                                                                        <span>
                                                                            {name.substring(0, matchIndex)}
                                                                            <span className="font-bold text-amber-600">
                                                                                {name.substring(matchIndex, matchIndex + matchLength)}
                                                                            </span>
                                                                            {name.substring(matchIndex + matchLength)}
                                                                        </span>
                                                                    ) : (
                                                                        name
                                                                    )}
                                                                </CommandItem>
                                                            );
                                                        })}
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
                                        setCorrectedValue(warning.matchedName || '');
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mt-1">
                                {warning.matchedName ? (
                                    <span className="font-medium text-lg text-green-600">
                                        "{warning.matchedName}"
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

                        {warning.matchReason && !editMode && (
                            <div className="text-xs text-slate-500 mt-1">
                                ({warning.matchReason})
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex justify-between gap-2 py-3 bg-slate-50 border-t">
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onPrevious}
                        disabled={currentIndex === 0}
                        className="text-slate-600"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onSkipAll}
                        className="text-slate-500"
                    >
                        <SkipForward className="h-4 w-4 mr-1" />
                        Skip All
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleIgnore}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Ignore
                    </Button>

                    <Button
                        size="sm"
                        onClick={handleConfirm}
                        disabled={editMode && !getCorrectedValue()}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        title="Enter to confirm"
                    >
                        <Check className="h-4 w-4 mr-1" />
                        Confirm
                    </Button>

                    {duplicateCount > 0 && (
                        <Button
                            size="sm"
                            onClick={handleConfirmAll}
                            disabled={editMode && !getCorrectedValue()}
                            className="bg-green-700 hover:bg-green-800 text-white border-l border-green-800"
                            title="Confirm for all matches (Ctrl+Enter)"
                        >
                            <Check className="h-4 w-4 mr-1" />
                            All ({duplicateCount + 1})
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}

// Compact summary for info and exact matches
interface CompactWarningGroupProps {
    group: WarningGroup;
    warnings: StructuredWarning[];
    onAcceptAll: () => void;
}

function CompactWarningGroup({ group, warnings, onAcceptAll }: CompactWarningGroupProps) {
    const [isOpen, setIsOpen] = useState(group.defaultOpen);
    const pendingCount = warnings.filter(w => w.status === 'pending').length;
    const resolvedCount = warnings.length - pendingCount;

    if (warnings.length === 0) return null;

    return (
        <div className={`border rounded-lg ${group.borderClass} ${group.bgClass} overflow-hidden`}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-2.5 hover:bg-black/5 transition-colors">
                        <div className="flex items-center gap-2">
                            {group.icon}
                            <span className={`font-medium text-sm ${group.colorClass}`}>{group.label}</span>
                            <span className="text-xs text-slate-500">
                                ({warnings.length})
                                {resolvedCount > 0 && (
                                    <span className="text-green-600 ml-1">✓{resolvedCount}</span>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {pendingCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAcceptAll();
                                    }}
                                    className="h-6 px-2 text-xs"
                                >
                                    Accept All
                                </Button>
                            )}
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <ul className="px-3 pb-2 space-y-1 text-sm">
                        {warnings.map(warning => (
                            <li key={warning.id} className={`py-1 ${warning.status === 'accepted' ? 'text-green-700' :
                                warning.status === 'rejected' ? 'text-slate-400 line-through' : ''
                                }`}>
                                {warning.category === 'match-exact' ? (
                                    <span>
                                        <span className="font-medium">{warning.playerName}</span>
                                        {': '}"{warning.requestedName}" → "{warning.matchedName}"
                                        {warning.status === 'accepted' && <Check className="h-3 w-3 inline ml-1 text-green-600" />}
                                    </span>
                                ) : (
                                    <span>{warning.message}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

export function WarningPanel({ warnings, onNavigateToRoster, onConfirmLoad, knownPlayerNames = [] }: WarningPanelProps) {
    const [structuredWarnings, setStructuredWarnings] = useState<StructuredWarning[]>(() =>
        parseWarnings(warnings)
    );
    const [currentWizardIndex, setCurrentWizardIndex] = useState(0);
    const [wizardComplete, setWizardComplete] = useState(false);

    // Re-parse when warnings change
    useEffect(() => {
        setStructuredWarnings(parseWarnings(warnings));
        setCurrentWizardIndex(0);
        setWizardComplete(false);
    }, [warnings]);

    // Warnings that need wizard review (Needs Review + Not Found)
    const wizardWarnings = useMemo(() =>
        structuredWarnings.filter(w =>
            (w.category === 'match-review' || w.category === 'not-found') &&
            w.status === 'pending'
        ),
        [structuredWarnings]
    );

    // Clamp index if warnings length changes (e.g. after resolving)
    useEffect(() => {
        if (currentWizardIndex >= wizardWarnings.length && wizardWarnings.length > 0) {
            setCurrentWizardIndex(Math.max(0, wizardWarnings.length - 1));
        }
    }, [wizardWarnings.length, currentWizardIndex]);

    // Grouped warnings for compact display
    const groupedWarnings = useMemo(() => {
        const groups: Record<WarningCategory, StructuredWarning[]> = {
            'match-exact': [],
            'match-review': [],
            'not-found': [],
            'info': []
        };

        structuredWarnings.forEach(w => {
            groups[w.category].push(w);
        });

        return groups;
    }, [structuredWarnings]);

    const stats = useMemo(() => {
        const total = structuredWarnings.filter(w => w.category !== 'info').length;
        const resolved = structuredWarnings.filter(w => w.category !== 'info' && w.status !== 'pending').length;
        return { total, resolved };
    }, [structuredWarnings]);

    const handleConfirmWarning = (id: string, correctedValue?: string) => {
        setStructuredWarnings(prev =>
            prev.map(w => w.id === id ? {
                ...w,
                status: 'accepted' as const,
                matchedName: correctedValue || w.matchedName
            } : w)
        );

        // Keep current index, unless it's now out of bounds
        // (Removing an item shifts subsequent items left)
        if (wizardWarnings.length <= 1) {
            setWizardComplete(true);
        }
    };

    const handleConfirmAll = (id: string, correctedValue?: string) => {
        const warning = structuredWarnings.find(w => w.id === id);
        if (!warning) return;

        setStructuredWarnings(prev =>
            prev.map(w =>
                (w.id === id || (w.status === 'pending' && w.requestedName === warning.requestedName))
                    ? {
                        ...w,
                        status: 'accepted' as const,
                        matchedName: correctedValue || w.matchedName
                    }
                    : w
            )
        );

        // Check if we exhausted the list
        const resolvedCount = 1 + wizardWarnings.filter(w => w.id !== id && w.requestedName === warning.requestedName).length;
        if (wizardWarnings.length <= resolvedCount) {
            setWizardComplete(true);
        }
    };

    const handleIgnoreWarning = (id: string) => {
        setStructuredWarnings(prev =>
            prev.map(w => w.id === id ? { ...w, status: 'rejected' as const } : w)
        );

        if (wizardWarnings.length <= 1) {
            setWizardComplete(true);
        }
    };



    const handlePreviousWarning = () => {
        if (currentWizardIndex > 0) {
            setCurrentWizardIndex(prev => prev - 1);
        }
    };

    const handleSkipAll = () => {
        setWizardComplete(true);
    };

    const handleAcceptAllInCategory = (category: WarningCategory) => {
        setStructuredWarnings(prev =>
            prev.map(w => w.category === category && w.status === 'pending'
                ? { ...w, status: 'accepted' as const }
                : w
            )
        );
    };

    if (warnings.length === 0) return null;

    // Show wizard if there are pending warnings to review
    const hasWizardWarnings = wizardWarnings.length > 0 && !wizardComplete;
    const currentWizardWarning = hasWizardWarnings ? wizardWarnings[currentWizardIndex] : null;

    const duplicateCount = useMemo(() => {
        if (!currentWizardWarning) return 0;
        return wizardWarnings.filter(w =>
            w.id !== currentWizardWarning.id &&
            w.requestedName === currentWizardWarning.requestedName
        ).length;
    }, [currentWizardWarning, wizardWarnings]);

    return (
        <Alert className="border-amber-200 bg-amber-50/50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
                {/* Header with progress */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <span className="font-medium text-amber-800">Warnings</span>
                        {stats.total > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                                {stats.resolved} of {stats.total} resolved
                            </span>
                        )}
                    </div>
                    {onNavigateToRoster && wizardComplete && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                onConfirmLoad();
                                onNavigateToRoster();
                            }}
                            className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                            Resolve in Roster →
                        </Button>
                    )}
                </div>

                {/* Wizard Card for one-at-a-time review */}
                {hasWizardWarnings && currentWizardWarning && (
                    <div className="mb-4">
                        <WarningWizardCard
                            warning={currentWizardWarning}
                            currentIndex={currentWizardIndex}
                            totalCount={wizardWarnings.length}
                            onConfirm={handleConfirmWarning}
                            onIgnore={handleIgnoreWarning}
                            onPrevious={handlePreviousWarning}
                            onSkipAll={handleSkipAll}
                            onConfirmAll={handleConfirmAll}
                            duplicateCount={duplicateCount}
                            knownPlayerNames={knownPlayerNames}
                        />
                    </div>
                )}

                {/* Compact groups for info and exact matches (always shown) */}
                {(wizardComplete || !hasWizardWarnings) && (
                    <div className="space-y-2">
                        {/* Show completed review/not-found as compact summaries */}
                        {wizardComplete && (groupedWarnings['match-review'].length > 0 || groupedWarnings['not-found'].length > 0) && (
                            <>
                                <CompactWarningGroup
                                    group={WARNING_GROUPS.find(g => g.category === 'match-review')!}
                                    warnings={groupedWarnings['match-review']}
                                    onAcceptAll={() => handleAcceptAllInCategory('match-review')}
                                />
                                <CompactWarningGroup
                                    group={WARNING_GROUPS.find(g => g.category === 'not-found')!}
                                    warnings={groupedWarnings['not-found']}
                                    onAcceptAll={() => handleAcceptAllInCategory('not-found')}
                                />
                            </>
                        )}

                        {/* Always show exact matches and info */}
                        <CompactWarningGroup
                            group={WARNING_GROUPS.find(g => g.category === 'match-exact')!}
                            warnings={groupedWarnings['match-exact']}
                            onAcceptAll={() => handleAcceptAllInCategory('match-exact')}
                        />
                        <CompactWarningGroup
                            group={WARNING_GROUPS.find(g => g.category === 'info')!}
                            warnings={groupedWarnings['info']}
                            onAcceptAll={() => handleAcceptAllInCategory('info')}
                        />
                    </div>
                )}
            </AlertDescription>
        </Alert>
    );
}
