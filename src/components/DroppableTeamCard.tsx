import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Team, LeagueConfig, getEffectiveSkillRating } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DraggablePlayerCard } from './DraggablePlayerCard';
import { Users, MoreHorizontal, Maximize2 } from 'lucide-react';
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

interface DroppableTeamCardProps {
    team: Team;
    config: LeagueConfig;
    onNameChange: (id: string, name: string) => void;
    onRemoveTeam?: (id: string) => void;
}

export function DroppableTeamCard({ team, config, onNameChange, onRemoveTeam }: DroppableTeamCardProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: team.id,
        data: { type: 'team', team },
    });

    const [isEditing, setIsEditing] = React.useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
    const [tempName, setTempName] = React.useState(team.name);

    const handleNameSave = () => {
        if (tempName.trim()) {
            onNameChange(team.id, tempName.trim());
        } else {
            setTempName(team.name);
        }
        setIsEditing(false);
    };

    // Stats
    const playerCount = team.players.length;
    const isOverCapacity = playerCount > config.maxTeamSize;


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

    const genderIssues =
        femaleCount < config.minFemales ||
        maleCount < config.minMales;

    // Status Color
    let statusColor = 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-primary/30';
    if (isOver) statusColor = 'border-primary ring-2 ring-primary/20 shadow-xl transform scale-[1.02] z-10';
    else if (isOverCapacity) statusColor = 'border-red-200 bg-red-50/30';
    else if (genderIssues) statusColor = 'border-orange-200 bg-orange-50/30';

    // Skill Color
    const getSkillColor = (val: number) => {
        if (val >= 8.0) return 'text-emerald-700 bg-emerald-100 border-emerald-200';
        if (val >= 5.0) return 'text-amber-700 bg-amber-100 border-amber-200';
        return 'text-red-700 bg-red-100 border-red-200';
    };

    const avgSkillValue = parseFloat(avgSkill);
    const skillColorClass = !isNaN(avgSkillValue) ? getSkillColor(avgSkillValue) : 'text-slate-500 bg-slate-100 border-slate-200';

    return (
        <Card className={`relative h-full flex flex-col transition-all duration-300 rounded-2xl border-2 border-b-4 shadow-sm group ${statusColor}`}>
            <CardHeader className="p-3 pb-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    {isEditing ? (
                        <Input
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                            autoFocus
                            className="h-8 text-sm font-bold border-slate-300 focus:ring-indigo-500"
                        />
                    ) : (
                        <div
                            className="flex-1 min-w-0 group/name"
                            onClick={() => {
                                setTempName(team.name);
                                setIsEditing(true);
                            }}
                        >
                            <CardTitle className="text-[15px] font-bold truncate text-slate-800 group-hover/name:text-indigo-600 transition-colors flex items-center gap-2 cursor-pointer">
                                {team.name}
                            </CardTitle>
                        </div>
                    )}

                    <div className="flex items-center gap-1">
                        <Badge variant={isOverCapacity ? "destructive" : "secondary"} className={`text-[10px] px-1.5 h-5 font-medium ${isOverCapacity ? '' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {playerCount}/{config.maxTeamSize}
                        </Badge>
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

                        <div className="hidden group-hover:block absolute top-2 right-10 md:static md:block md:static">
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

                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                        <div className={`flex items-center gap-0.5 ${femaleCount < config.minFemales ? 'text-red-600 font-bold' : ''}`}>
                            <span className="text-slate-400">F:</span>
                            <span>{femaleCount}</span>
                        </div>
                        <div className={`flex items-center gap-0.5 ${maleCount < config.minMales ? 'text-red-600 font-bold' : ''}`}>
                            <span className="text-slate-400">M:</span>
                            <span>{maleCount}</span>
                        </div>
                        <div className={`flex items-center gap-0.5 ${handlerCount < targetHandlers ? 'text-orange-600 font-bold' : ''}`}>
                            <span className="text-slate-400">H:</span>
                            <span>{handlerCount}</span>
                        </div>
                    </div>
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
                                    {team.players.filter(p => p.gender === 'F').map((player) => (
                                        <DraggablePlayerCard key={player.id} player={player} compact />
                                    ))}
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
                                    {team.players.filter(p => p.gender === 'M').map((player) => (
                                        <DraggablePlayerCard key={player.id} player={player} compact />
                                    ))}
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
                            {team.name}
                            <Badge variant={isOverCapacity ? "destructive" : "secondary"}>
                                {playerCount}/{config.maxTeamSize}
                            </Badge>
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
                                            <DraggablePlayerCard player={player} />
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
                                            <DraggablePlayerCard player={player} />
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
        </Card >
    );
}
