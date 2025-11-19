import React from 'react';
import { Team, LeagueConfig } from '@/types';
import { DroppableTeamCard } from './DroppableTeamCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface TeamBoardProps {
    teams: Team[];
    config: LeagueConfig;
    onTeamNameChange: (id: string, name: string) => void;
    onRemoveTeam?: (id: string) => void;
    onAddTeam?: () => void;
}

export function TeamBoard({ teams, config, onTeamNameChange, onRemoveTeam, onAddTeam }: TeamBoardProps) {
    return (
        <div className="flex-1 h-full bg-gray-100/50 p-6 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Team Board</h1>
                    <p className="text-sm text-gray-500">Drag and drop players to build balanced teams</p>
                </div>
                {onAddTeam && (
                    <Button onClick={onAddTeam} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Team
                    </Button>
                )}
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                    {teams.map((team) => (
                        <div key={team.id} className="min-h-[200px]">
                            <DroppableTeamCard
                                team={team}
                                config={config}
                                onNameChange={onTeamNameChange}
                                onRemoveTeam={onRemoveTeam}
                            />
                        </div>
                    ))}

                    {/* Add Team Placeholder */}
                    {onAddTeam && (
                        <button
                            onClick={onAddTeam}
                            className="h-[400px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all group"
                        >
                            <div className="h-12 w-12 rounded-full bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center mb-3 transition-colors">
                                <Plus className="h-6 w-6" />
                            </div>
                            <span className="font-medium">Create New Team</span>
                        </button>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
