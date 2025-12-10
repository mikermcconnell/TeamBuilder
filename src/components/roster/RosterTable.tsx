import React, { useState, useMemo } from 'react';
import { Player, Gender, getEffectiveSkillRating } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    Settings2,
    Check,
    UserCheck,
    UserX,
    Trash2,
    Eye,
    Edit
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
    getSkillGroupInfo: (group: string) => any;
    getSkillGradientStyle: (rating: number) => any;
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
    getSkillGradientStyle
}: RosterTableProps) {
    // Sorting state
    const [sortConfig, setSortConfig] = useState<SortConfig[]>([
        { field: 'name', direction: 'asc' }
    ]);

    // Column visibility state
    const [columnVisibility, setColumnVisibility] = useState({
        select: true,
        name: true,
        gender: true,
        skill: true,
        exec: true,
        group: true,
        isHandler: true,
        teammates: true,
        avoid: true,
        actions: true
    });

    // Inline editing state
    const [editingCell, setEditingCell] = useState<{ id: string, field: 'skill' | 'exec' } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Handle sorting
    const handleSort = (field: SortField, multi: boolean) => {
        setSortConfig(current => {
            const existingIndex = current.findIndex(s => s.field === field);
            let newConfig = [...current];

            if (existingIndex >= 0) {
                // Toggle direction or remove if it's the only sort and we want to toggle off? 
                // Usually just toggle direction.
                if (newConfig[existingIndex]?.direction === 'asc') {
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

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
                            <Settings2 className="mr-2 h-4 w-4" />
                            Columns
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[150px]">
                        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.keys(columnVisibility).map((key) => {
                            if (key === 'select' || key === 'actions') return null;
                            return (
                                <DropdownMenuCheckboxItem
                                    key={key}
                                    className="capitalize"
                                    checked={columnVisibility[key as keyof typeof columnVisibility]}
                                    onCheckedChange={(checked) =>
                                        setColumnVisibility((prev) => ({ ...prev, [key]: checked }))
                                    }
                                >
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                </DropdownMenuCheckboxItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
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
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={(e) => handleSort('name', e.shiftKey)}
                                >
                                    <div className="flex items-center">Name {getSortIcon('name')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.gender && (
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={(e) => handleSort('gender', e.shiftKey)}
                                >
                                    <div className="flex items-center">Gender {getSortIcon('gender')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.skill && (
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={(e) => handleSort('skillRating', e.shiftKey)}
                                >
                                    <div className="flex items-center">Skill {getSortIcon('skillRating')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.exec && (
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={(e) => handleSort('execSkillRating', e.shiftKey)}
                                >
                                    <div className="flex items-center">Exec {getSortIcon('execSkillRating')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.group && (
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={(e) => handleSort('group', e.shiftKey)}
                                >
                                    <div className="flex items-center">Group {getSortIcon('group')}</div>
                                </TableHead>
                            )}
                            {columnVisibility.isHandler && (
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={(e) => handleSort('isHandler', e.shiftKey)}
                                >
                                    <div className="flex items-center">Handler {getSortIcon('isHandler')}</div>
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
                                <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedPlayers.map((player) => (
                                <TableRow key={player.id} className="group">
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
                                        <TableCell className="font-medium">{player.name}</TableCell>
                                    )}
                                    {columnVisibility.gender && (
                                        <TableCell>
                                            <Badge variant="outline">{player.gender}</Badge>
                                        </TableCell>
                                    )}
                                    {columnVisibility.skill && (
                                        <TableCell>
                                            {editingCell?.id === player.id && editingCell.field === 'skill' ? (
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-16 h-8"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit(player);
                                                            if (e.key === 'Escape') setEditingCell(null);
                                                        }}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(player)}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-muted/50"
                                                    onClick={() => startEditing(player.id, 'skill', player.skillRating)}
                                                >
                                                    <div
                                                        className="px-2 py-0.5 rounded text-sm font-medium"
                                                        style={getSkillGradientStyle(player.skillRating)}
                                                    >
                                                        {player.skillRating}
                                                    </div>
                                                </div>
                                            )}
                                        </TableCell>
                                    )}
                                    {columnVisibility.exec && (
                                        <TableCell>
                                            {editingCell?.id === player.id && editingCell.field === 'exec' ? (
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-16 h-8"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit(player);
                                                            if (e.key === 'Escape') setEditingCell(null);
                                                        }}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(player)}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-muted/50"
                                                    onClick={() => startEditing(player.id, 'exec', player.execSkillRating)}
                                                >
                                                    {player.execSkillRating !== null ? (
                                                        <div
                                                            className="px-2 py-0.5 rounded text-sm font-medium"
                                                            style={getSkillGradientStyle(player.execSkillRating)}
                                                        >
                                                            {player.execSkillRating}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm px-2">N/A</span>
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
                                                            className={`${getSkillGroupInfo(getSkillGroup(player)).bgColor} ${getSkillGroupInfo(getSkillGroup(player)).textColor} border cursor-help`}
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
                                        <TableCell>
                                            <Checkbox
                                                checked={!!player.isHandler}
                                                onCheckedChange={(checked) => {
                                                    onPlayerUpdate({ ...player, isHandler: checked as boolean });
                                                }}
                                                aria-label={`Toggle handler for ${player.name}`}
                                            />
                                        </TableCell>
                                    )}
                                    {columnVisibility.teammates && (
                                        <TableCell>
                                            {player.teammateRequests.length > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    <UserCheck className="h-3 w-3 text-green-600" />
                                                    <span className="text-sm">{player.teammateRequests.length}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                    )}
                                    {columnVisibility.avoid && (
                                        <TableCell>
                                            {player.avoidRequests.length > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    <UserX className="h-3 w-3 text-red-600" />
                                                    <span className="text-sm">{player.avoidRequests.length}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                    )}
                                    {columnVisibility.actions && (
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewPlayer(player)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditPlayer(player)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                {onPlayerRemove && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onPlayerRemove(player)}>
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
            <div className="text-xs text-muted-foreground">
                {selectedPlayerIds.size} of {players.length} row(s) selected.
            </div>
        </div>
    );
}
