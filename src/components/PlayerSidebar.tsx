import React, { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Player, PlayerGroup } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DraggablePlayerCard } from './DraggablePlayerCard';
import { Search, Filter, ArrowUpDown, Users } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PlayerSidebarProps {
    players: Player[];
    playerGroups: PlayerGroup[];
}

export function PlayerSidebar({ players, playerGroups }: PlayerSidebarProps) {
    const { setNodeRef } = useDroppable({
        id: 'unassigned',
        data: { type: 'container', id: 'unassigned' },
    });

    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F' | 'H'>('ALL');
    const [sortBy, setSortBy] = useState<'name' | 'skill'>('skill');

    const filteredPlayers = useMemo(() => {
        return players
            .filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
                const matchesGender = genderFilter === 'ALL' ||
                    (genderFilter === 'H' ? p.isHandler : p.gender === genderFilter);
                return matchesSearch && matchesGender;
            })
            .sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                // Sort by skill descending
                const skillA = a.execSkillRating ?? a.skillRating;
                const skillB = b.execSkillRating ?? b.skillRating;
                return skillB - skillA;
            });
    }, [players, search, genderFilter, sortBy]);

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full max-w-xs">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Player Pool
                        <span className="text-xs font-normal text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
                            {players.length}
                        </span>
                    </h2>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search players..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>

                {/* Filters & Sort */}
                <div className="flex items-center gap-2">
                    <Tabs value={genderFilter} onValueChange={(v) => setGenderFilter(v as any)} className="flex-1">
                        <TabsList className="w-full grid grid-cols-4 h-8">
                            <TabsTrigger value="ALL" className="text-xs">All</TabsTrigger>
                            <TabsTrigger value="M" className="text-xs">M</TabsTrigger>
                            <TabsTrigger value="F" className="text-xs">F</TabsTrigger>
                            <TabsTrigger value="H" className="text-xs">H</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSortBy('skill')}>
                                Sort by Skill (High to Low)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('name')}>
                                Sort by Name (A-Z)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-hidden bg-gray-50/50">
                <SortableContext
                    id="unassigned"
                    items={filteredPlayers.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ScrollArea className="h-full">
                        <div ref={setNodeRef} className="p-3 space-y-2 min-h-[500px]">
                            {filteredPlayers.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8 text-sm">
                                    No players found
                                </div>
                            ) : (
                                filteredPlayers.map(player => (
                                    <DraggablePlayerCard
                                        key={player.id}
                                        player={player}
                                        compact
                                    />
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </SortableContext>
            </div>
        </div>
    );
}
