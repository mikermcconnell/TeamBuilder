import React, { useState, useMemo } from 'react';
import { Player } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Check,
    UserCheck,
    UserX,
    Trash2,
    Eye,
    Edit,
    Zap
} from 'lucide-react';

export type SortField = 'name' | 'gender' | 'skillRating' | 'execSkillRating' | 'isHandler' | 'group';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    field: SortField;
    direction: SortDirection;
}

interface RosterTableProps {
    players: Player[];
    selectedPlayerIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    onPlayerUpdate: (player: Player) => void;
    onPlayerRemove?: (player: Player) => void;
    onViewPlayer: (player: Player) => void;
    onEditPlayer: (player: Player) => void;
    getSkillGroup: (player: Player) => string;
    getSkillGroupInfo: (group: string) => { bgColor: string; textColor: string; description: string };
    getSkillGradientStyle: (rating: number) => React.CSSProperties;
    columnVisibility: Record<string, boolean>;
}

export function RosterTable({
    players,
    selectedPlayerIds,
    onSelectionChange,
    onPlayerUpdate,
    onPlayerRemove,
    onViewPlayer,
    onEditPlayer,
    getSkillGroup,
    getSkillGroupInfo,
    getSkillGradientStyle,
    columnVisibility
}: RosterTableProps) {
    // Sorting state
    const [sortConfig, setSortConfig] = useState<SortConfig[]>([
        { field: 'name', direction: 'asc' }
    ]);



    // Inline editing state
    const [editingCell, setEditingCell] = useState<{ id: string, field: 'skill' | 'exec' } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Handle sorting
    const handleSort = (field: SortField, multi: boolean) => {
        setSortConfig(current => {
            const existingIndex = current.findIndex(s => s.field === field);
            let newConfig = [...current];

            if (existingIndex >= 0 && newConfig[existingIndex]) {
                // Toggle direction or remove if it's the only sort and we want to toggle off? 
                // Usually just toggle direction.
                if (newConfig[existingIndex].direction === 'asc') {
                    newConfig[existingIndex].direction = 'desc';
                } else {
                    // If multi-sort, remove it on 3rd click? Or just toggle back to asc?
                    // Let's just toggle asc/desc for simplicity
                    newConfig[existingIndex].direction = 'asc';
                }
            } else {
                // Add new sort field
                if (!multi) {
                    newConfig = [{ field, direction: 'asc' }];
                } else {
                    newConfig.push({ field, direction: 'asc' });
                }
            }
            return newConfig;
        });
    };

    const getSortIcon = (field: SortField) => {
        const index = sortConfig.findIndex(s => s.field === field);
        if (index === -1) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;

        const config = sortConfig[index];
        return (
            <div className="flex items-center ml-2">
                {config?.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                {sortConfig.length > 1 && <span className="text-[10px] ml-0.5">{index + 1}</span>}
            </div>
        );
    };

    // Sort players
    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            for (const sort of sortConfig) {
                let aValue: any = '';
                let bValue: any = '';

                switch (sort.field) {
                    case 'name':
                        aValue = a.name.toLowerCase();
                        bValue = b.name.toLowerCase();
                        break;
                    case 'gender':
                        aValue = a.gender;
                        bValue = b.gender;
                        break;
                    case 'skillRating':
                        aValue = a.skillRating;
                        bValue = b.skillRating;
                        break;
                    case 'execSkillRating':
                        aValue = a.execSkillRating ?? -1;
                        bValue = b.execSkillRating ?? -1;
                        break;
                    case 'isHandler':
                        aValue = a.isHandler ? 1 : 0;
                        bValue = b.isHandler ? 1 : 0;
                        break;
                    case 'group':
                        aValue = getSkillGroup(a);
                        bValue = getSkillGroup(b);
                        break;
                }

                if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [players, sortConfig, getSkillGroup]);

    // Selection handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelectionChange(new Set(players.map(p => p.id)));
        } else {
            onSelectionChange(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelection = new Set(selectedPlayerIds);
        if (checked) {
            newSelection.add(id);
        } else {
            newSelection.delete(id);
        }
        onSelectionChange(newSelection);
    };

    // Inline edit handlers
    const startEditing = (id: string, field: 'skill' | 'exec', value: number | null) => {
        setEditingCell({ id, field });
        setEditValue(value?.toString() ?? '');
    };

    const saveEdit = (player: Player) => {
        if (!editingCell) return;

        const numValue = parseFloat(editValue);
        if (isNaN(numValue) && editingCell.field === 'skill') return; // Skill is required

        if (editingCell.field === 'skill') {
            onPlayerUpdate({ ...player, skillRating: Math.min(10, Math.max(0, numValue)) });
        } else {
            onPlayerUpdate({
                ...player,
                execSkillRating: editValue === '' ? null : Math.min(10, Math.max(0, numValue))
            });
        }
        setEditingCell(null);
    };

    // Helper for Avatar colors
    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-red-100 text-red-600',
            'bg-orange-100 text-orange-600',
            'bg-amber-100 text-amber-600',
            'bg-yellow-100 text-yellow-600',
            'bg-lime-100 text-lime-600',
            'bg-green-100 text-green-600',
            'bg-emerald-100 text-emerald-600',
            'bg-teal-100 text-teal-600',
            'bg-cyan-100 text-cyan-600',
            'bg-sky-100 text-sky-600',
            'bg-blue-100 text-blue-600',
            'bg-indigo-100 text-indigo-600',
            'bg-violet-100 text-violet-600',
            'bg-purple-100 text-purple-600',
            'bg-fuchsia-100 text-fuchsia-600',
            'bg-pink-100 text-pink-600',
            'bg-rose-100 text-rose-600',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <div className="space-y-4">
            {/* Columns Dropdown moved to PlayerRoster */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <Table className="[&_tr_th:first-child]:pl-8 [&_tr_td:first-child]:pl-8 [&_tr_th:last-child]:pr-8 [&_tr_td:last-child]:pr-8">
                    <TableHeader className="bg-slate-50/80">
                        <TableRow className="hover:bg-transparent border-b border-slate-100">
                            {columnVisibility.select && (
                                <TableHead className="w-[40px]">
                                    <Checkbox
                                        checked={players.length > 0 && selectedPlayerIds.size === players.length}
                                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                            )}
                            {columnVisibility.name && (
                                <TableHead
                                    className="cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => handleSort('name', e.shiftKey)}
                                >
                                    <div className="flex items-center gap-1">Name {getSortIcon('name')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.gender && (
                                <TableHead
                                    className="cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => handleSort('gender', e.shiftKey)}
                                >
                                    <div className="flex items-center gap-1">Gender {getSortIcon('gender')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.skill && (
                                <TableHead
                                    className="cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => handleSort('skillRating', e.shiftKey)}
                                >
                                    <div className="flex items-center gap-1">Skill {getSortIcon('skillRating')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.exec && (
                                <TableHead
                                    className="cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => handleSort('execSkillRating', e.shiftKey)}
                                >
                                    <div className="flex items-center gap-1">Exec {getSortIcon('execSkillRating')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.group && (
                                <TableHead
                                    className="cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => handleSort('group', e.shiftKey)}
                                >
                                    <div className="flex items-center gap-1">Group {getSortIcon('group')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.isHandler && (
                                <TableHead
                                    className="cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => handleSort('isHandler', e.shiftKey)}
                                >
                                    <div className="flex items-center gap-1">Handler {getSortIcon('isHandler')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.teammates && <TableHead>Teammates</TableHead>}
                            {columnVisibility.avoid && <TableHead>Avoid</TableHead>}
                            {columnVisibility.actions && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedPlayers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length} className="h-32 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="bg-slate-100 p-3 rounded-full mb-2">
                                            <UserX className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <p>No players found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedPlayers.map((player) => (
                                <TableRow
                                    key={player.id}
                                    className={`
                                        group transition-colors hover:bg-slate-50/80 border-b border-slate-50 last:border-0
                                        ${selectedPlayerIds.has(player.id) ? 'bg-blue-50/30' : ''}
                                    `}
                                >
                                    {columnVisibility.select && (
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedPlayerIds.has(player.id)}
                                                onCheckedChange={(checked) => handleSelectRow(player.id, checked as boolean)}
                                                aria-label={`Select ${player.name}`}
                                            />
                                        </TableCell>
                                    )}
                                    {columnVisibility.name && (
                                        <TableCell className="font-medium py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`
                                                    h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm
                                                    ${getAvatarColor(player.name)}
                                                `}>
                                                    {getInitials(player.name)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-700">{player.name}</span>
                                                    {player.email && (
                                                        <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                                                            {player.email}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                    )}
                                    {columnVisibility.gender && (
                                        <TableCell className="py-3">
                                            <Badge variant="outline" className="border-slate-200 text-slate-600 bg-white">
                                                {player.gender}
                                            </Badge>
                                        </TableCell>
                                    )}
                                    {columnVisibility.skill && (
                                        <TableCell className="py-3">
                                            {editingCell?.id === player.id && editingCell.field === 'skill' ? (
                                                <div className="flex items-center gap-1 scale-110 origin-left">
                                                    <Input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-16 h-8 text-center font-bold"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit(player);
                                                            if (e.key === 'Escape') setEditingCell(null);
                                                        }}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => saveEdit(player)}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer group/skill"
                                                    onClick={() => startEditing(player.id, 'skill', player.skillRating)}
                                                >
                                                    <div
                                                        className="px-2.5 py-1 rounded-lg text-sm font-bold min-w-[36px] text-center shadow-sm border border-black/5 transition-transform group-hover/skill:scale-105"
                                                        style={getSkillGradientStyle(player.skillRating)}
                                                    >
                                                        {player.skillRating}
                                                    </div>
                                                    <Edit className="h-3 w-3 text-slate-300 opacity-0 group-hover/skill:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                        </TableCell>
                                    )}
                                    {columnVisibility.exec && (
                                        <TableCell>
                                            {editingCell?.id === player.id && editingCell.field === 'exec' ? (
                                                <div className="flex items-center gap-1 scale-110 origin-left">
                                                    <Input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-16 h-8 text-center font-bold"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit(player);
                                                            if (e.key === 'Escape') setEditingCell(null);
                                                        }}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => saveEdit(player)}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer group/exec"
                                                    onClick={() => startEditing(player.id, 'exec', player.execSkillRating)}
                                                >
                                                    {player.execSkillRating !== null ? (
                                                        <>
                                                            <div
                                                                className="px-2.5 py-1 rounded-lg text-sm font-bold min-w-[36px] text-center shadow-sm border border-black/5 transition-transform group-hover/exec:scale-105"
                                                                style={getSkillGradientStyle(player.execSkillRating)}
                                                            >
                                                                {player.execSkillRating}
                                                            </div>
                                                            <Edit className="h-3 w-3 text-slate-300 opacity-0 group-hover/exec:opacity-100 transition-opacity" />
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs px-2 italic">Set</span>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    )}
                                    {columnVisibility.group && (
                                        <TableCell>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge
                                                            className={`
                                                                ${getSkillGroupInfo(getSkillGroup(player)).bgColor} 
                                                                ${getSkillGroupInfo(getSkillGroup(player)).textColor} 
                                                                border-2 border-transparent hover:border-current
                                                                transition-colors cursor-help
                                                            `}
                                                        >
                                                            {getSkillGroup(player)}
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        {getSkillGroupInfo(getSkillGroup(player)).description}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </TableCell>
                                    )}
                                    {columnVisibility.isHandler && (
                                        <TableCell className="py-2">
                                            <button
                                                onClick={() => onPlayerUpdate({ ...player, isHandler: !player.isHandler })}
                                                className={`
                                                    p-1.5 rounded-full transition-all border-2
                                                    ${player.isHandler
                                                        ? 'bg-yellow-100 border-yellow-200 text-yellow-600 hover:scale-110'
                                                        : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-100 hover:text-slate-400'
                                                    }
                                                `}
                                                title={player.isHandler ? "Handler" : "Not Handler"}
                                            >
                                                <Zap className="h-4 w-4 fill-current" />
                                            </button>
                                        </TableCell>
                                    )}
                                    {columnVisibility.teammates && (
                                        <TableCell>
                                            {player.teammateRequests.length > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    <div className="bg-green-100 p-1 rounded-full">
                                                        <UserCheck className="h-3 w-3 text-green-600" />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-600">{player.teammateRequests.length}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-200 text-sm">-</span>
                                            )}
                                        </TableCell>
                                    )}
                                    {columnVisibility.avoid && (
                                        <TableCell>
                                            {player.avoidRequests.length > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    <div className="bg-red-100 p-1 rounded-full">
                                                        <UserX className="h-3 w-3 text-red-600" />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-600">{player.avoidRequests.length}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-200 text-sm">-</span>
                                            )}
                                        </TableCell>
                                    )}
                                    {columnVisibility.actions && (
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => onViewPlayer(player)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => onEditPlayer(player)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                {onPlayerRemove && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => onPlayerRemove(player)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="text-xs text-muted-foreground ml-2">
                {selectedPlayerIds.size} of {players.length} players selected
            </div>
        </div>
    );
}
