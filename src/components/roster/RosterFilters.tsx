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
        <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                        placeholder="Search by name..."
                        value={filters.search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-12 h-12 rounded-2xl border-2 border-slate-200 focus-visible:ring-0 focus-visible:border-primary/50 text-base shadow-sm"
                    />
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <Select
                        value={filters.gender}
                        onValueChange={(value) => handleGenderChange(value as Gender | 'all')}
                    >
                        <SelectTrigger className="w-full sm:w-[140px] h-12 rounded-2xl border-2 border-slate-200 font-bold text-slate-600">
                            <SelectValue placeholder="Gender" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 border-slate-100">
                            <SelectItem value="all" className="font-bold text-slate-600">All Genders</SelectItem>
                            <SelectItem value="M" className="font-bold text-blue-500">Male</SelectItem>
                            <SelectItem value="F" className="font-bold text-pink-500">Female</SelectItem>
                            <SelectItem value="Other" className="font-bold text-slate-500">Other</SelectItem>
                        </SelectContent>
                    </Select>

                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" className="h-12 rounded-2xl border-2 border-slate-200 px-4 gap-2 relative hover:bg-slate-50 hover:text-primary hover:border-primary/30 transition-all font-bold text-slate-600">
                                <Filter className="h-5 w-5" />
                                <span className="hidden sm:inline">Filters</span>
                                {activeFilterCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-6 w-6 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground border-2 border-white shadow-sm absolute -top-2 -right-2 pointer-events-none">
                                        {activeFilterCount}
                                    </Badge>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="overflow-y-auto sm:max-w-md w-full">
                            <SheetHeader className="mb-6">
                                <SheetTitle className="text-2xl font-black text-slate-800">Filter Roster</SheetTitle>
                                <SheetDescription className="text-base font-medium text-slate-400">
                                    Fine-tune your player list with advanced filters.
                                </SheetDescription>
                            </SheetHeader>

                            <div className="py-2 space-y-8">
                                {/* Skill Range */}
                                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-extrabold text-slate-700">Skill Rating</Label>
                                        <Badge variant="outline" className="text-base font-bold bg-white border-2 border-slate-200 px-3 py-1">
                                            {localFilters.minSkill} - {localFilters.maxSkill}
                                        </Badge>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={[localFilters.minSkill, localFilters.maxSkill]}
                                        onValueChange={([min, max]) => setLocalFilters({
                                            ...localFilters,
                                            minSkill: min ?? 0,
                                            maxSkill: max ?? 10
                                        })}
                                        className="py-4 cursor-pointer"
                                    />
                                </div>

                                {/* Exec Skill Range */}
                                <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-extrabold text-slate-700">Exec Rating</Label>
                                        <Badge variant="outline" className="text-base font-bold bg-white border-2 border-slate-200 px-3 py-1">
                                            {localFilters.minExecSkill} - {localFilters.maxExecSkill}
                                        </Badge>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={[localFilters.minExecSkill, localFilters.maxExecSkill]}
                                        onValueChange={([min, max]) => setLocalFilters({
                                            ...localFilters,
                                            minExecSkill: min ?? 0,
                                            maxExecSkill: max ?? 10
                                        })}
                                        className="py-4 cursor-pointer"
                                    />
                                </div>

                                {/* Skill Groups */}
                                <div className="space-y-3">
                                    <Label className="text-base font-extrabold text-slate-700">Skill Groups</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {skillGroups.map((group) => {
                                            const isSelected = localFilters.skillGroups.includes(group);
                                            return (
                                                <div
                                                    key={group}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setLocalFilters({
                                                                ...localFilters,
                                                                skillGroups: localFilters.skillGroups.filter((g) => g !== group),
                                                            });
                                                        } else {
                                                            setLocalFilters({
                                                                ...localFilters,
                                                                skillGroups: [...localFilters.skillGroups, group],
                                                            });
                                                        }
                                                    }}
                                                    className={`
                                                        cursor-pointer px-4 py-2 rounded-xl text-sm font-bold border-b-4 active:border-b-0 active:translate-y-1 transition-all
                                                        ${isSelected
                                                            ? 'bg-blue-500 text-white border-blue-700 shadow-sm'
                                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                        }
                                                    `}
                                                >
                                                    {group}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Attributes */}
                                <div className="space-y-4">
                                    <Label className="text-base font-extrabold text-slate-700">Attributes</Label>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                                            <Label htmlFor="has-email" className="font-bold text-slate-600">Has Email</Label>
                                            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                                {['any', 'yes', 'no'].map((opt) => {
                                                    const val = opt === 'any' ? null : opt === 'yes';
                                                    const isActive = localFilters.hasEmail === val;
                                                    return (
                                                        <button
                                                            key={opt}
                                                            onClick={() => setLocalFilters({ ...localFilters, hasEmail: val })}
                                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${isActive ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {opt.toUpperCase()}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                                            <Label htmlFor="has-requests" className="font-bold text-slate-600">Has Requests</Label>
                                            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                                {['any', 'yes', 'no'].map((opt) => {
                                                    const val = opt === 'any' ? null : opt === 'yes';
                                                    const isActive = localFilters.hasRequests === val;
                                                    return (
                                                        <button
                                                            key={opt}
                                                            onClick={() => setLocalFilters({ ...localFilters, hasRequests: val })}
                                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${isActive ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {opt.toUpperCase()}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <SheetFooter className="flex-col sm:flex-row gap-3 mt-8 pb-8 sm:pb-0">
                                <Button
                                    variant="outline"
                                    onClick={handleResetFilters}
                                    className="w-full sm:w-1/3 h-12 rounded-xl border-2 font-bold text-slate-500 hover:text-slate-700"
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                                <Button
                                    onClick={handleApplyFilters}
                                    className="w-full sm:w-2/3 h-12 rounded-xl text-base font-black border-b-4 border-primary-shadow active:border-b-0 active:translate-y-1 transition-all"
                                >
                                    Apply Filters
                                </Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>
                </div>

                {activeFilterCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetFilters}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full px-3"
                    >
                        <X className="mr-1 h-4 w-4" />
                        Clear All
                    </Button>
                )}
            </div>

            {/* Active Filter Tags */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    {filters.gender !== 'all' && (
                        <Badge variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200">
                            Gender: {filters.gender}
                            <div className="ml-2 h-5 w-5 rounded-full bg-white/50 flex items-center justify-center cursor-pointer hover:bg-white" onClick={() => handleGenderChange('all')}>
                                <X className="h-3 w-3" />
                            </div>
                        </Badge>
                    )}
                    {(filters.minSkill > 0 || filters.maxSkill < 10) && (
                        <Badge variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200">
                            Skill: {filters.minSkill}-{filters.maxSkill}
                            <div className="ml-2 h-5 w-5 rounded-full bg-white/50 flex items-center justify-center cursor-pointer hover:bg-white" onClick={() => onFilterChange({ ...filters, minSkill: 0, maxSkill: 10 })}>
                                <X className="h-3 w-3" />
                            </div>
                        </Badge>
                    )}
                    {(filters.minExecSkill > 0 || filters.maxExecSkill < 10) && (
                        <Badge variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200">
                            Exec: {filters.minExecSkill}-{filters.maxExecSkill}
                            <div className="ml-2 h-5 w-5 rounded-full bg-white/50 flex items-center justify-center cursor-pointer hover:bg-white" onClick={() => onFilterChange({ ...filters, minExecSkill: 0, maxExecSkill: 10 })}>
                                <X className="h-3 w-3" />
                            </div>
                        </Badge>
                    )}
                    {filters.skillGroups.map(group => (
                        <Badge key={group} variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200">
                            Group: {group}
                            <div className="ml-2 h-5 w-5 rounded-full bg-white/50 flex items-center justify-center cursor-pointer hover:bg-white" onClick={() => onFilterChange({ ...filters, skillGroups: filters.skillGroups.filter(g => g !== group) })}>
                                <X className="h-3 w-3" />
                            </div>
                        </Badge>
                    ))}
                    {filters.hasEmail !== null && (
                        <Badge variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                            Email: {filters.hasEmail ? 'Yes' : 'No'}
                            <div className="ml-2 h-5 w-5 rounded-full bg-white/50 flex items-center justify-center cursor-pointer hover:bg-white" onClick={() => onFilterChange({ ...filters, hasEmail: null })}>
                                <X className="h-3 w-3" />
                            </div>
                        </Badge>
                    )}
                    {filters.hasRequests !== null && (
                        <Badge variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-pink-100 text-pink-700 hover:bg-pink-200">
                            Requests: {filters.hasRequests ? 'Yes' : 'No'}
                            <div className="ml-2 h-5 w-5 rounded-full bg-white/50 flex items-center justify-center cursor-pointer hover:bg-white" onClick={() => onFilterChange({ ...filters, hasRequests: null })}>
                                <X className="h-3 w-3" />
                            </div>
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}
