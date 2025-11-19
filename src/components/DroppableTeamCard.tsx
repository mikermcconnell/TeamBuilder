import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Team, LeagueConfig, getEffectiveSkillRating } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DraggablePlayerCard } from './DraggablePlayerCard';
import { Users, MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    const isUnderCapacity = playerCount < config.maxTeamSize - 2;

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

    const genderIssues =
        femaleCount < config.minFemales ||
        maleCount < config.minMales;

    // Status Color
    let statusColor = 'border-gray-200';
    if (isOver) statusColor = 'border-primary ring-2 ring-primary/50';
    else if (isOverCapacity) statusColor = 'border-red-200 bg-red-50/30';
    else if (genderIssues) statusColor = 'border-orange-200 bg-orange-50/30';
    else if (!isUnderCapacity) statusColor = 'border-green-200 bg-green-50/30';

    return (
        <Card className={`h-full flex flex-col transition-all duration-200 ${statusColor}`}>
            <CardHeader className="p-3 pb-2 space-y-0">
                <div className="flex items-center justify-between gap-2">
                    {isEditing ? (
                        <Input
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                            autoFocus
                            className="h-7 text-sm font-bold"
                        />
                    ) : (
                        <CardTitle
                            className="text-sm font-bold truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => {
                                setTempName(team.name);
                                setIsEditing(true);
                            }}
                        >
                            {team.name}
                        </CardTitle>
                    )}

                    <div className="flex items-center gap-1">
                        <Badge variant={isOverCapacity ? "destructive" : "secondary"} className="text-[10px] px-1.5 h-5">
                            {playerCount}/{config.maxTeamSize}
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreHorizontal className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                    </div>
                </div>

                {/* Mini Stats */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                    <div className="flex items-center gap-1">
                        <span className="font-bold text-foreground">{avgSkill}</span> Avg
                    </div>
                    <div className={`flex items-center gap-1 ${femaleCount < config.minFemales ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                        <span>{femaleCount}F</span>
                        <span className="text-[9px] opacity-80">
                            ({femaleCount - config.minFemales >= 0 ? '+' : ''}{femaleCount - config.minFemales})
                        </span>
                    </div>
                    <div className={`flex items-center gap-1 ${maleCount < config.minMales ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                        <span>{maleCount}M</span>
                        <span className="text-[9px] opacity-80">
                            ({maleCount - config.minMales >= 0 ? '+' : ''}{maleCount - config.minMales})
                        </span>
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
        </Card>
    );
}
