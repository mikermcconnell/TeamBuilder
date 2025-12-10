import React from 'react';
import { Gender } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose,
} from '@/components/ui/sheet';
import { Search, Filter, X, RotateCcw } from 'lucide-react';

export interface RosterFilterState {
    search: string;
    gender: Gender | 'all';
    minSkill: number;
    maxSkill: number;
    minExecSkill: number;
    maxExecSkill: number;
    skillGroups: string[];
    hasEmail: boolean | null; // null = ignore, true = yes, false = no
    hasRequests: boolean | null;
}

export const initialFilterState: RosterFilterState = {
    search: '',
    gender: 'all',
    minSkill: 0,
    maxSkill: 10,
    minExecSkill: 0,
    maxExecSkill: 10,
    skillGroups: [],
    hasEmail: null,
    hasRequests: null,
};

interface RosterFiltersProps {
    filters: RosterFilterState;
    onFilterChange: (filters: RosterFilterState) => void;
    skillGroups: string[]; // Available skill groups (Elite, Good, etc.)
}

export function RosterFilters({ filters, onFilterChange, skillGroups }: RosterFiltersProps) {
    // Local state for sheet to avoid applying filters on every slider move if desired,
    // but for now we'll apply directly or maybe use a local state for the sheet form.
    // Let's use local state for the sheet to allow "Apply" action, but search/gender can be instant.

    const [sheetOpen, setSheetOpen] = React.useState(false);
    const [localFilters, setLocalFilters] = React.useState<RosterFilterState>(filters);

    // Sync local filters when sheet opens or external filters change
    React.useEffect(() => {
        setLocalFilters(filters);
    }, [filters, sheetOpen]);

    const handleSearchChange = (value: string) => {
        onFilterChange({ ...filters, search: value });
    };

    const handleGenderChange = (value: Gender | 'all') => {
        onFilterChange({ ...filters, gender: value });
    };

    const handleApplyFilters = () => {
        onFilterChange(localFilters);
        setSheetOpen(false);
    };

    const handleResetFilters = () => {
        const resetState = {
            ...initialFilterState,
            search: filters.search, // Keep search
        };
        setLocalFilters(resetState);
        onFilterChange(resetState);
        setSheetOpen(false);
    };

    const activeFilterCount = React.useMemo(() => {
        let count = 0;
        if (filters.gender !== 'all') count++;
        if (filters.minSkill > 0 || filters.maxSkill < 10) count++;
        if (filters.minExecSkill > 0 || filters.maxExecSkill < 10) count++;
        if (filters.skillGroups.length > 0) count++;
        if (filters.hasEmail !== null) count++;
        if (filters.hasRequests !== null) count++;
        return count;
    }, [filters]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name..."
                        value={filters.search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <Select
                    value={filters.gender}
                    onValueChange={(value) => handleGenderChange(value as Gender | 'all')}
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Genders</SelectItem>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                </Select>

                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="gap-2 relative">
                            <Filter className="h-4 w-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent className="overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>Filter Roster</SheetTitle>
                            <SheetDescription>
                                Narrow down players by skill, attributes, and more.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="py-6 space-y-8">
                            {/* Skill Range */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Skill Rating</Label>
                                    <span className="text-sm text-muted-foreground">
                                        {localFilters.minSkill} - {localFilters.maxSkill}
                                    </span>
                                </div>
                                <Slider
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    value={[localFilters.minSkill, localFilters.maxSkill]}
                                    onValueChange={([min, max]) => setLocalFilters({ ...localFilters, minSkill: min, maxSkill: max })}
                                    className="py-4"
                                />
                            </div>

                            {/* Exec Skill Range */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Exec Skill Rating</Label>
                                    <span className="text-sm text-muted-foreground">
                                        {localFilters.minExecSkill} - {localFilters.maxExecSkill}
                                    </span>
                                </div>
                                <Slider
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    value={[localFilters.minExecSkill, localFilters.maxExecSkill]}
                                    onValueChange={([min, max]) => setLocalFilters({ ...localFilters, minExecSkill: min, maxExecSkill: max })}
                                    className="py-4"
                                />
                            </div>

                            {/* Skill Groups */}
                            <div className="space-y-3">
                                <Label>Skill Groups</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {skillGroups.map((group) => (
                                        <div key={group} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`group-${group}`}
                                                checked={localFilters.skillGroups.includes(group)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setLocalFilters({
                                                            ...localFilters,
                                                            skillGroups: [...localFilters.skillGroups, group],
                                                        });
                                                    } else {
                                                        setLocalFilters({
                                                            ...localFilters,
                                                            skillGroups: localFilters.skillGroups.filter((g) => g !== group),
                                                        });
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={`group-${group}`} className="text-sm font-normal cursor-pointer">
                                                {group}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Attributes */}
                            <div className="space-y-4">
                                <Label>Attributes</Label>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="has-email" className="font-normal">Has Email Address</Label>
                                        <Select
                                            value={localFilters.hasEmail === null ? 'any' : localFilters.hasEmail ? 'yes' : 'no'}
                                            onValueChange={(val) => setLocalFilters({
                                                ...localFilters,
                                                hasEmail: val === 'any' ? null : val === 'yes'
                                            })}
                                        >
                                            <SelectTrigger className="w-[100px] h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="any">Any</SelectItem>
                                                <SelectItem value="yes">Yes</SelectItem>
                                                <SelectItem value="no">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="has-requests" className="font-normal">Has Requests</Label>
                                        <Select
                                            value={localFilters.hasRequests === null ? 'any' : localFilters.hasRequests ? 'yes' : 'no'}
                                            onValueChange={(val) => setLocalFilters({
                                                ...localFilters,
                                                hasRequests: val === 'any' ? null : val === 'yes'
                                            })}
                                        >
                                            <SelectTrigger className="w-[100px] h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="any">Any</SelectItem>
                                                <SelectItem value="yes">Yes</SelectItem>
                                                <SelectItem value="no">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <SheetFooter className="flex-col sm:flex-row gap-2">
                            <Button variant="outline" onClick={handleResetFilters} className="w-full sm:w-auto">
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset
                            </Button>
                            <Button onClick={handleApplyFilters} className="w-full sm:w-auto">
                                Apply Filters
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                {activeFilterCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetFilters}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Active Filter Tags */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {filters.gender !== 'all' && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Gender: {filters.gender}
                            <X
                                className="h-3 w-3 cursor-pointer ml-1"
                                onClick={() => handleGenderChange('all')}
                            />
                        </Badge>
                    )}
                    {(filters.minSkill > 0 || filters.maxSkill < 10) && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Skill: {filters.minSkill}-{filters.maxSkill}
                            <X
                                className="h-3 w-3 cursor-pointer ml-1"
                                onClick={() => onFilterChange({ ...filters, minSkill: 0, maxSkill: 10 })}
                            />
                        </Badge>
                    )}
                    {(filters.minExecSkill > 0 || filters.maxExecSkill < 10) && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Exec: {filters.minExecSkill}-{filters.maxExecSkill}
                            <X
                                className="h-3 w-3 cursor-pointer ml-1"
                                onClick={() => onFilterChange({ ...filters, minExecSkill: 0, maxExecSkill: 10 })}
                            />
                        </Badge>
                    )}
                    {filters.skillGroups.map(group => (
                        <Badge key={group} variant="secondary" className="flex items-center gap-1">
                            Group: {group}
                            <X
                                className="h-3 w-3 cursor-pointer ml-1"
                                onClick={() => onFilterChange({ ...filters, skillGroups: filters.skillGroups.filter(g => g !== group) })}
                            />
                        </Badge>
                    ))}
                    {filters.hasEmail !== null && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Email: {filters.hasEmail ? 'Yes' : 'No'}
                            <X
                                className="h-3 w-3 cursor-pointer ml-1"
                                onClick={() => onFilterChange({ ...filters, hasEmail: null })}
                            />
                        </Badge>
                    )}
                    {filters.hasRequests !== null && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Requests: {filters.hasRequests ? 'Yes' : 'No'}
                            <X
                                className="h-3 w-3 cursor-pointer ml-1"
                                onClick={() => onFilterChange({ ...filters, hasRequests: null })}
                            />
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}
