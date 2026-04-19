import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Player, Team, LeagueConfig, PlayerGroup, PlayerUpdateHandler, getEffectiveSkillRating } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DraggablePlayerCard } from './DraggablePlayerCard';
import { Users, MoreHorizontal, Maximize2, Palette } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TEAM_BRAND_PALETTE, getColorName, hexToRgba } from '@/utils/teamBranding';
import { sanitizeLegacyTeamName } from '@/utils/groupLabels';
import { getPlayerAgeBand } from '@/utils/playerAgeBands';
import { getPlayerDisplayAge } from '@/utils/playerProfile';

interface DroppableTeamCardProps {
    team: Team;
    allPlayers: Player[];
    config: LeagueConfig;
    largestTeamSize?: number;
    onPlayerUpdate?: PlayerUpdateHandler;
    onNameChange: (id: string, name: string) => void;
    onBrandingChange?: (id: string, updates: {
        name?: string;
        color?: string;
        colorName?: string;
        resetName?: boolean;
        resetColor?: boolean;
    }) => void;
    onRemoveTeam?: (id: string) => void;
    playerGroups?: PlayerGroup[];
}

export function DroppableTeamCard({ team, allPlayers, config, largestTeamSize = 0, onPlayerUpdate, onNameChange, onBrandingChange, onRemoveTeam, playerGroups = [] }: DroppableTeamCardProps) {
    const displayTeamName = sanitizeLegacyTeamName(team.name);
    // Helper to get group info for a player
    const getPlayerGroupInfo = (playerId: string) => {
        const group = playerGroups.find(g => g.playerIds.includes(playerId));
        return group ? { color: group.color, label: group.label } : null;
    };
    const { setNodeRef, isOver } = useDroppable({
        id: team.id,
        data: { type: 'team', team },
    });

    const [isEditing, setIsEditing] = React.useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
    const [isBrandingOpen, setIsBrandingOpen] = React.useState(false);
    const [tempName, setTempName] = React.useState(displayTeamName);
    const [brandingName, setBrandingName] = React.useState(displayTeamName);
    const [brandingColor, setBrandingColor] = React.useState(team.color || '#94A3B8');

    React.useEffect(() => {
        setTempName(displayTeamName);
        setBrandingName(displayTeamName);
        setBrandingColor(team.color || '#94A3B8');
    }, [displayTeamName, team.color]);

    const handleNameSave = () => {
        if (tempName.trim()) {
            onNameChange(team.id, tempName.trim());
        } else {
            setTempName(displayTeamName);
        }
        setIsEditing(false);
    };

    const handleBrandingSave = () => {
        if (!onBrandingChange) {
            setIsBrandingOpen(false);
            return;
        }

        const trimmedName = brandingName.trim();
        if (trimmedName) {
            onBrandingChange(team.id, {
                name: trimmedName,
                color: safeBrandingColor,
                colorName: getColorName(safeBrandingColor),
            });
        } else {
            onBrandingChange(team.id, {
                color: safeBrandingColor,
                colorName: getColorName(safeBrandingColor),
            });
        }

        setIsBrandingOpen(false);
    };

    // Stats
    const playerCount = team.players.length;
    const isOverCapacity = playerCount > config.maxTeamSize;
    const shortfallCount = Math.max(0, largestTeamSize - playerCount);
    const isShortTeam = shortfallCount > 0;


    const totalSkill = team.players.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0);
    const avgSkill = playerCount > 0 ? (totalSkill / playerCount).toFixed(1) : '--';

    const genderBreakdown = team.players.reduce(
        (acc, p) => {
            acc[p.gender] = (acc[p.gender] || 0) + 1;
            return acc;
        },
        { M: 0, F: 0, Other: 0 } as Record<string, number>
    );

    const femaleCount = genderBreakdown.F || 0;
    const maleCount = genderBreakdown.M || 0;
    const handlerCount = team.players.filter(p => p.isHandler).length;
    const targetHandlers = 3; // Based on "three handlers per team" request
  const youngPlayerCount = team.players.filter(player => getPlayerAgeBand(getPlayerDisplayAge(player)) === 'young').length;
  const wisePlayerCount = team.players.filter(player => getPlayerAgeBand(getPlayerDisplayAge(player)) === 'wise').length;

    const getAverageSkillForGender = (gender: 'M' | 'F' | 'Other') => {
        const genderPlayers = team.players.filter(player => player.gender === gender);
        if (genderPlayers.length === 0) {
            return null;
        }

        const totalGenderSkill = genderPlayers.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0);
        return totalGenderSkill / genderPlayers.length;
    };

    const maleAverageSkill = getAverageSkillForGender('M');
    const femaleAverageSkill = getAverageSkillForGender('F');
    const formatAverageSkill = (value: number | null) => (value === null ? '--' : value.toFixed(1));

    const getLeagueAverageSkillForGender = (gender: 'M' | 'F' | 'Other') => {
        const genderPlayers = allPlayers.filter(player => player.gender === gender);
        if (genderPlayers.length === 0) {
            return null;
        }

        const totalGenderSkill = genderPlayers.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0);
        return totalGenderSkill / genderPlayers.length;
    };

    const maleTargetAverageSkill = getLeagueAverageSkillForGender('M');
    const femaleTargetAverageSkill = getLeagueAverageSkillForGender('F');

    const getAverageComparisonMeta = (value: number | null, target: number | null, accent: 'blue' | 'pink') => {
        if (value === null || target === null) {
            return {
                className: 'border-slate-200 bg-slate-50 text-slate-600',
                deltaLabel: 'no target',
            };
        }

        const difference = value - target;
        if (Math.abs(difference) <= 0.25) {
            return {
                className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                deltaLabel: 'on target',
            };
        }

        if (difference > 0) {
            return {
                className: accent === 'blue'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-pink-200 bg-pink-50 text-pink-700',
                deltaLabel: `+${difference.toFixed(1)} vs target`,
            };
        }

        return {
            className: 'border-amber-200 bg-amber-50 text-amber-700',
            deltaLabel: `${difference.toFixed(1)} vs target`,
        };
    };

    const maleAverageMeta = getAverageComparisonMeta(maleAverageSkill, maleTargetAverageSkill, 'blue');
    const femaleAverageMeta = getAverageComparisonMeta(femaleAverageSkill, femaleTargetAverageSkill, 'pink');

    const genderIssues =
        femaleCount < config.minFemales ||
        maleCount < config.minMales;

    // Status Color
    let statusColor = 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-primary/30';
    if (isOver) statusColor = 'border-primary ring-2 ring-primary/20 shadow-xl transform scale-[1.02] z-10';
    else if (isOverCapacity) statusColor = 'border-red-200 bg-red-50/30';
    else if (genderIssues) statusColor = 'border-orange-200 bg-orange-50/30';
    else if (isShortTeam) statusColor = 'border-sky-200 bg-sky-50/40';

    // Skill Color
    const getSkillColor = (val: number) => {
        if (val >= 8.0) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
        if (val >= 5.0) return 'text-amber-700 bg-amber-100 border-amber-200';
        return 'text-red-700 bg-red-100 border-red-200';
    };

    const avgSkillValue = parseFloat(avgSkill);
    const skillColorClass = !isNaN(avgSkillValue) ? getSkillColor(avgSkillValue) : 'text-slate-500 bg-slate-100 border-slate-200';
    const teamColor = team.color || '#94A3B8';
    const safeBrandingColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandingColor) ? brandingColor : '#94A3B8';

    return (
        <Card
            className={`relative h-full flex flex-col transition-all duration-300 rounded-2xl border-2 border-b-4 shadow-sm group ${statusColor}`}
            style={{
                borderColor: isOver || isOverCapacity || genderIssues ? undefined : hexToRgba(teamColor, 0.35),
                backgroundColor: isOver || isOverCapacity || genderIssues ? undefined : hexToRgba(teamColor, 0.06),
            }}
        >
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ backgroundColor: teamColor }} />
            <CardHeader className="p-3 pb-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                        <Input
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                            autoFocus
                            className="h-8 min-w-0 flex-1 text-sm font-bold border-slate-300 focus:ring-indigo-500"
                        />
                    ) : (
                        <div
                            className="flex-1 min-w-0 group/name cursor-pointer"
                            onClick={() => {
                                setTempName(displayTeamName);
                                setIsEditing(true);
                            }}
                        >
                            <CardTitle className="min-w-0 text-[15px] font-bold text-slate-800 group-hover/name:text-indigo-600 transition-colors">
                                <div className="flex min-w-0 flex-col items-start gap-1">
                                    <span
                                        className="block min-w-0 max-w-full break-words pr-1 leading-tight"
                                        style={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                        title={displayTeamName}
                                    >
                                        {displayTeamName}
                                    </span>
                                {team.colorName && (
                                    <Badge
                                        variant="secondary"
                                        className="hidden w-fit shrink-0 sm:inline-flex text-[10px] font-semibold border"
                                        style={{
                                            backgroundColor: hexToRgba(teamColor, 0.12),
                                            color: teamColor,
                                            borderColor: hexToRgba(teamColor, 0.25),
                                        }}
                                    >
                                        {team.colorName}
                                    </Badge>
                                )}
                                </div>
                            </CardTitle>
                        </div>
                    )}

                    <div className="flex shrink-0 items-start gap-1 pl-1">
                        <Badge
                            variant={isOverCapacity ? "destructive" : "secondary"}
                            className={`h-7 px-2 text-base font-bold md:text-lg ${isOverCapacity
                                ? ''
                                : isShortTeam
                                    ? 'border border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {playerCount}/{config.maxTeamSize}
                        </Badge>
                        {isShortTeam && (
                            <Badge variant="secondary" className="h-7 px-2 border border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-200">
                                Short {shortfallCount}
                            </Badge>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setIsDetailsOpen(true)}>
                                    <Maximize2 className="h-4 w-4 mr-2" />
                                    View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                                    Rename Team
                                </DropdownMenuItem>
                                {onBrandingChange && (
                                    <DropdownMenuItem onClick={() => setIsBrandingOpen(true)}>
                                        <Palette className="h-4 w-4 mr-2" />
                                        Edit Branding
                                    </DropdownMenuItem>
                                )}
                                {onRemoveTeam && (
                                    <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onClick={() => onRemoveTeam(team.id)}
                                    >
                                        Delete Team
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="absolute right-10 top-2 hidden group-hover:block">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                onClick={() => setIsDetailsOpen(true)}
                                title="Expand Team View"
                            >
                                <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="flex items-center justify-between gap-2 pt-1">
                    {/* Avg Skill Pill */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${skillColorClass} shadow-sm`}>
                        <span>Avg</span>
                        <span className="text-[12px]">{avgSkill}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xl font-bold text-slate-600">
                        <div className={`flex items-center gap-1 ${femaleCount < config.minFemales ? 'text-red-600' : ''}`}>
                            <span>F:</span>
                            <span>{femaleCount}</span>
                            {femaleCount < config.minFemales && (
                                <span className="text-red-600 text-sm">(-{config.minFemales - femaleCount})</span>
                            )}
                            {femaleCount > config.minFemales && (
                                <span className="text-green-600 text-sm">(+{femaleCount - config.minFemales})</span>
                            )}
                        </div>
                        <div className={`flex items-center gap-1 ${maleCount < config.minMales ? 'text-red-600' : ''}`}>
                            <span>M:</span>
                            <span>{maleCount}</span>
                            {maleCount < config.minMales && (
                                <span className="text-red-600 text-sm">(-{config.minMales - maleCount})</span>
                            )}
                            {maleCount > config.minMales && (
                                <span className="text-green-600 text-sm">(+{maleCount - config.minMales})</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <span>H:</span>
                            <span>{handlerCount}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {isShortTeam && (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            <span>Short</span>
                            <span className="text-[12px]">-{shortfallCount}</span>
                        </div>
                    )}
                    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${maleAverageMeta.className}`}>
                        <span>M Avg</span>
                        <span className="text-[12px]">{formatAverageSkill(maleAverageSkill)}</span>
                        <span className="text-[10px] opacity-80">({maleAverageMeta.deltaLabel})</span>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${femaleAverageMeta.className}`}>
                        <span>F Avg</span>
                        <span className="text-[12px]">{formatAverageSkill(femaleAverageSkill)}</span>
                        <span className="text-[10px] opacity-80">({femaleAverageMeta.deltaLabel})</span>
                    </div>
                    {youngPlayerCount > 0 && (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            <span>Young</span>
                            <span className="text-[12px]">{youngPlayerCount}</span>
                        </div>
                    )}
                    {wisePlayerCount > 0 && (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <span>Wise</span>
                            <span className="text-[12px]">{wisePlayerCount}</span>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-2 m-2 rounded-md border border-dashed border-gray-200">
                <SortableContext
                    id={team.id}
                    items={team.players.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div ref={setNodeRef} className="space-y-3 min-h-full">
                        {team.players.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs p-4 text-center mt-8">
                                <Users className="h-6 w-6 mb-2 opacity-50" />
                                <span>Drop players here</span>
                            </div>
                        )}

                        {/* Females Section */}
                        {team.players.some(p => p.gender === 'F') && (
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-bold text-pink-600 uppercase tracking-wider px-1 flex items-center justify-between border-b border-pink-100 pb-0.5">
                                    <span>Females</span>
                                    <span className="bg-pink-100 text-pink-700 px-1.5 rounded-full text-[9px]">{team.players.filter(p => p.gender === 'F').length}</span>
                                </div>
                                <div className="space-y-1">
                                    {team.players.filter(p => p.gender === 'F').map((player) => {
                                        const groupInfo = getPlayerGroupInfo(player.id);
                                        return (
                                            <DraggablePlayerCard
                                                key={player.id}
                                                player={player}
                                                compact
                                                groupColor={groupInfo?.color}
                                                groupLabel={groupInfo?.label}
                                                onPlayerUpdate={onPlayerUpdate}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Males Section */}
                        {team.players.some(p => p.gender === 'M') && (
                            <div className="space-y-1.5">
                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider px-1 flex items-center justify-between border-b border-blue-100 pb-0.5">
                                    <span>Males</span>
                                    <span className="bg-blue-100 text-blue-700 px-1.5 rounded-full text-[9px]">{team.players.filter(p => p.gender === 'M').length}</span>
                                </div>
                                <div className="space-y-1">
                                    {team.players.filter(p => p.gender === 'M').map((player) => {
                                        const groupInfo = getPlayerGroupInfo(player.id);
                                        return (
                                            <DraggablePlayerCard
                                                key={player.id}
                                                player={player}
                                                compact
                                                groupColor={groupInfo?.color}
                                                groupLabel={groupInfo?.label}
                                                onPlayerUpdate={onPlayerUpdate}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </SortableContext>
            </CardContent>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: teamColor }} />
                            {displayTeamName}
                            <Badge variant={isOverCapacity ? "destructive" : "secondary"}>
                                {playerCount}/{config.maxTeamSize}
                            </Badge>
                            {isShortTeam && (
                                <Badge variant="secondary" className="border border-sky-200 bg-sky-100 text-sky-700">
                                    Short {shortfallCount}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Stats Summary */}
                    <div className="flex flex-wrap gap-4 py-2 border-b">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Average Skill</span>
                            <span className="text-2xl font-bold">{avgSkill}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Females</span>
                            <div className={`flex items-baseline gap-1 ${femaleCount < config.minFemales ? 'text-red-600' : 'text-green-600'}`}>
                                <span className="text-2xl font-bold">{femaleCount}</span>
                                <span className="text-xs font-medium">/{config.minFemales}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Males</span>
                            <div className={`flex items-baseline gap-1 ${maleCount < config.minMales ? 'text-red-600' : 'text-green-600'}`}>
                                <span className="text-2xl font-bold">{maleCount}</span>
                                <span className="text-xs font-medium">/{config.minMales}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Handlers</span>
                            <div className={`flex items-baseline gap-1 ${handlerCount < targetHandlers ? 'text-orange-600' : 'text-green-600'}`}>
                                <span className="text-2xl font-bold">{handlerCount}</span>
                                <span className="text-xs font-medium">/{targetHandlers}</span>
                            </div>
                        </div>
                        {youngPlayerCount > 0 && (
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase font-bold">Young</span>
                                <span className="text-2xl font-bold text-sky-700">{youngPlayerCount}</span>
                            </div>
                        )}
                        {wisePlayerCount > 0 && (
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground uppercase font-bold">Wise</span>
                                <span className="text-2xl font-bold text-amber-700">{wisePlayerCount}</span>
                            </div>
                        )}
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Male Avg</span>
                            <span className={`text-2xl font-bold ${maleAverageMeta.className.includes('emerald') ? 'text-emerald-700' : maleAverageMeta.className.includes('amber') ? 'text-amber-700' : 'text-blue-700'}`}>
                                {formatAverageSkill(maleAverageSkill)}
                            </span>
                            <span className="text-xs text-muted-foreground">Target {formatAverageSkill(maleTargetAverageSkill)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Female Avg</span>
                            <span className={`text-2xl font-bold ${femaleAverageMeta.className.includes('emerald') ? 'text-emerald-700' : femaleAverageMeta.className.includes('amber') ? 'text-amber-700' : 'text-pink-700'}`}>
                                {formatAverageSkill(femaleAverageSkill)}
                            </span>
                            <span className="text-xs text-muted-foreground">Target {formatAverageSkill(femaleTargetAverageSkill)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {/* Females Column */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-b pb-1 border-pink-100">
                                <h3 className="font-bold text-pink-700 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Females
                                </h3>
                                <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-200">
                                    {team.players.filter(p => p.gender === 'F').length}
                                </Badge>
                            </div>
                            <div className="space-y-2">
                                {team.players
                                    .filter(p => p.gender === 'F')
                                    .sort((a, b) => getEffectiveSkillRating(b) - getEffectiveSkillRating(a))
                                    .map(player => (
                                        <div key={player.id} className="pointer-events-none">
                                            <DraggablePlayerCard player={player} onPlayerUpdate={onPlayerUpdate} />
                                        </div>
                                    ))}
                                {team.players.filter(p => p.gender === 'F').length === 0 && (
                                    <p className="text-sm text-gray-400 italic py-2">No female players assigned</p>
                                )}
                            </div>
                        </div>

                        {/* Males Column */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-b pb-1 border-blue-100">
                                <h3 className="font-bold text-blue-700 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Males
                                </h3>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                                    {team.players.filter(p => p.gender === 'M').length}
                                </Badge>
                            </div>
                            <div className="space-y-2">
                                {team.players
                                    .filter(p => p.gender === 'M')
                                    .sort((a, b) => getEffectiveSkillRating(b) - getEffectiveSkillRating(a))
                                    .map(player => (
                                        <div key={player.id} className="pointer-events-none">
                                            <DraggablePlayerCard player={player} onPlayerUpdate={onPlayerUpdate} />
                                        </div>
                                    ))}
                                {team.players.filter(p => p.gender === 'M').length === 0 && (
                                    <p className="text-sm text-gray-400 italic py-2">No male players assigned</p>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isBrandingOpen} onOpenChange={setIsBrandingOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            Edit Team Branding
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor={`team-name-${team.id}`}>Team Name</Label>
                            <Input
                                id={`team-name-${team.id}`}
                                value={brandingName}
                                onChange={(e) => setBrandingName(e.target.value)}
                                placeholder="Enter a team name"
                            />
                            <div className="flex justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        onBrandingChange?.(team.id, { resetName: true });
                                        setIsBrandingOpen(false);
                                    }}
                                >
                                    Reset to Auto Name
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <Label htmlFor={`team-color-${team.id}`}>Team Color</Label>
                                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-slate-600">
                                    <span className="h-3 w-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: brandingColor }} />
                                    {getColorName(safeBrandingColor)}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {TEAM_BRAND_PALETTE.map((palette) => {
                                    const isSelected = palette.color.toLowerCase() === brandingColor.toLowerCase();
                                    return (
                                        <button
                                            key={palette.color}
                                            type="button"
                                            onClick={() => setBrandingColor(palette.color)}
                                            className={`rounded-xl border p-2 text-left transition-all ${isSelected ? 'border-slate-900 shadow-sm' : 'border-slate-200 hover:border-slate-400'
                                                }`}
                                        >
                                            <div className="h-8 rounded-lg mb-2" style={{ backgroundColor: palette.color }} />
                                            <div className="text-xs font-semibold text-slate-700">{palette.colorName}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor={`team-color-custom-${team.id}`}>Custom Hex Color</Label>
                                <div className="flex items-center gap-3">
                                    <input
                                        id={`team-color-custom-${team.id}`}
                                        type="color"
                                        value={safeBrandingColor}
                                        onChange={(e) => setBrandingColor(e.target.value)}
                                        className="h-10 w-14 rounded border border-slate-200 bg-white p-1"
                                    />
                                    <Input
                                        value={brandingColor}
                                        onChange={(e) => setBrandingColor(e.target.value)}
                                        placeholder="#2563EB"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        onBrandingChange?.(team.id, { resetColor: true });
                                        setIsBrandingOpen(false);
                                    }}
                                >
                                    Reset to Auto Color
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-2xl border p-4" style={{ backgroundColor: hexToRgba(safeBrandingColor, 0.08), borderColor: hexToRgba(safeBrandingColor, 0.25) }}>
                            <div className="flex items-center gap-3">
                                <span className="h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: safeBrandingColor }} />
                                <div>
                                    <div className="font-bold text-slate-800">{brandingName || displayTeamName}</div>
                                    <div className="text-sm text-slate-500">{getColorName(safeBrandingColor)} team preview</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsBrandingOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleBrandingSave}>
                                Save Branding
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card >
    );
}
