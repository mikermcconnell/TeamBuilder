import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Player, PlayerGroup, getEffectiveSkillRating } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DraggablePlayerCard } from './DraggablePlayerCard';
import { Search, ArrowUpDown, Users } from 'lucide-react';
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
    const [sortBy, setSortBy] = useState<'name' | 'skill' | 'group'>('skill');

    // Filter players based on search and gender
    const filterPlayer = (p: Player) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesGender = genderFilter === 'ALL' ||
            (genderFilter === 'H' ? p.isHandler : p.gender === genderFilter);
        return matchesSearch && matchesGender;
    };

    // Helper to check if player is in a group
    const isInGroup = (playerId: string) => {
        return playerGroups.some(g => g.playerIds.includes(playerId));
    };

    // When sorting by group, prepare grouped data
    const { groupedDisplay, ungroupedPlayers, filteredPlayers } = useMemo(() => {
        const filtered = players.filter(filterPlayer);

        if (sortBy !== 'group') {
            // Regular sorting
            // When using M/F/H filter (not 'ALL'), show singles first, groups at bottom
            const shouldSinglesFirst = genderFilter !== 'ALL';

            const sorted = [...filtered].sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name);

                // When filtering by gender, put singles first
                if (shouldSinglesFirst) {
                    const aInGroup = isInGroup(a.id);
                    const bInGroup = isInGroup(b.id);

                    if (!aInGroup && bInGroup) return -1; // singles first
                    if (aInGroup && !bInGroup) return 1;  // groups last
                }

                // Sub-sort by skill descending
                return getEffectiveSkillRating(b) - getEffectiveSkillRating(a);
            });
            return { groupedDisplay: [], ungroupedPlayers: [], filteredPlayers: sorted };
        }

        // Group mode: organize players into groups
        const playerIdsInGroups = new Set<string>();
        const groupsWithPlayers: { group: PlayerGroup; players: Player[]; avgSkill: number }[] = [];

        // Find groups that have players in the current pool
        playerGroups.forEach(group => {
            const groupPlayersInPool = filtered.filter(p => group.playerIds.includes(p.id));
            if (groupPlayersInPool.length > 0) {
                groupPlayersInPool.forEach(p => playerIdsInGroups.add(p.id));
                const avgSkill = groupPlayersInPool.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0) / groupPlayersInPool.length;
                groupsWithPlayers.push({
                    group,
                    players: groupPlayersInPool.sort((a, b) => getEffectiveSkillRating(b) - getEffectiveSkillRating(a)),
                    avgSkill
                });
            }
        });

        // Sort groups by average skill descending
        groupsWithPlayers.sort((a, b) => b.avgSkill - a.avgSkill);

        // Find ungrouped players
        const ungrouped = filtered
            .filter(p => !playerIdsInGroups.has(p.id))
            .sort((a, b) => getEffectiveSkillRating(b) - getEffectiveSkillRating(a));

        return { groupedDisplay: groupsWithPlayers, ungroupedPlayers: ungrouped, filteredPlayers: [] };
    }, [players, search, genderFilter, sortBy, playerGroups]);

    // Get all player IDs for SortableContext
    const allPlayerIds = useMemo(() => {
        if (sortBy === 'group') {
            const groupedIds = groupedDisplay.flatMap(g => g.players.map(p => p.id));
            const ungroupedIds = ungroupedPlayers.map(p => p.id);
            return [...groupedIds, ...ungroupedIds];
        }
        return filteredPlayers.map(p => p.id);
    }, [sortBy, groupedDisplay, ungroupedPlayers, filteredPlayers]);

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
                        <TabsList className="w-full grid grid-cols-4 h-10">
                            <TabsTrigger value="ALL" className="text-base font-semibold">All</TabsTrigger>
                            <TabsTrigger value="M" className="text-base font-semibold">M</TabsTrigger>
                            <TabsTrigger value="F" className="text-base font-semibold">F</TabsTrigger>
                            <TabsTrigger value="H" className="text-base font-semibold">H</TabsTrigger>
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
                            <DropdownMenuItem onClick={() => setSortBy('group')}>
                                Sort by Group (Avg Skill)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-hidden bg-gray-50/50">
                <SortableContext
                    id="unassigned"
                    items={allPlayerIds}
                    strategy={verticalListSortingStrategy}
                >
                    <ScrollArea className="h-full">
                        <div ref={setNodeRef} className="p-3 space-y-2 min-h-[500px]">
                            {sortBy === 'group' ? (
                                <>
                                    {/* Grouped Players */}
                                    {groupedDisplay.map(({ group, players: groupPlayers, avgSkill }) => (
                                        <div
                                            key={group.id}
                                            className="rounded-xl border-2 border-l-4 p-2 mb-3 bg-white shadow-sm"
                                            style={{ borderLeftColor: group.color }}
                                        >
                                            {/* Group Header */}
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                                        style={{ backgroundColor: group.color }}
                                                    >
                                                        {group.label}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-700">
                                                        Group {group.label}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        ({groupPlayers.length} players)
                                                    </span>
                                                </div>
                                                <div className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-sm font-bold">
                                                    Avg: {avgSkill.toFixed(1)}
                                                </div>
                                            </div>
                                            {/* Group Players */}
                                            <div className="space-y-1">
                                                {groupPlayers.map(player => (
                                                    <DraggablePlayerCard
                                                        key={player.id}
                                                        player={player}
                                                        compact
                                                        groupColor={group.color}
                                                        groupLabel={group.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Ungrouped Players Section */}
                                    {ungroupedPlayers.length > 0 && (
                                        <div className="mt-4">
                                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                                                Ungrouped Players ({ungroupedPlayers.length})
                                            </div>
                                            <div className="space-y-2">
                                                {ungroupedPlayers.map(player => (
                                                    <DraggablePlayerCard
                                                        key={player.id}
                                                        player={player}
                                                        compact
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {groupedDisplay.length === 0 && ungroupedPlayers.length === 0 && (
                                        <div className="text-center text-muted-foreground py-8 text-sm">
                                            No players found
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Regular list view
                                filteredPlayers.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-8 text-sm">
                                        No players found
                                    </div>
                                ) : (
                                    filteredPlayers.map(player => {
                                        const group = playerGroups.find(g => g.playerIds.includes(player.id));
                                        return (
                                            <DraggablePlayerCard
                                                key={player.id}
                                                player={player}
                                                compact
                                                groupColor={group?.color}
                                                groupLabel={group?.label}
                                            />
                                        );
                                    })
                                )
                            )}
                        </div>
                    </ScrollArea>
                </SortableContext>
            </div>
        </div>
    );
}
