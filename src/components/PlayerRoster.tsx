import React, { useState, useMemo, useCallback } from 'react';
import { Player, Gender, getEffectiveSkillRating } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Download,
  Plus,
  Trash2,
  UserMinus,
  UserCheck,
  MoreVertical,
  Search,
  Settings2,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkillDistributionChart } from './SkillDistributionChart';
import { RosterFilters, RosterFilterState, initialFilterState } from './roster/RosterFilters';
import { RosterTable } from './roster/RosterTable';

interface PlayerRosterProps {
  players: Player[];
  onPlayerUpdate: (player: Player) => void;
  onPlayerAdd?: (player: Player) => void;
  onPlayerRemove?: (playerId: string) => void;
}

export function PlayerRoster({ players, onPlayerUpdate, onPlayerAdd, onPlayerRemove }: PlayerRosterProps) {
  // State
  const [filters, setFilters] = useState<RosterFilterState>(initialFilterState);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
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

  // Dialog states
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);

  // New player form state
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    gender: 'Other' as Gender,
    skillRating: 5,
    teammateRequests: '',
    avoidRequests: '',
    email: ''
  });

  // Stats Calculation
  const getGenderStats = useMemo(() => {
    const stats = { M: 0, F: 0, Other: 0 };
    players.forEach(player => {
      stats[player.gender]++;
    });
    return stats;
  }, [players]);

  const getSkillStats = useMemo(() => {
    if (players.length === 0) return { min: 0, max: 0, avg: 0, execMin: 0, execMax: 0, execAvg: 0 };

    const skills = players.map(p => p.skillRating);
    const execSkills = players.map(p => p.execSkillRating).filter(rating => rating !== null) as number[];
    const min = Math.min(...skills);
    const max = Math.max(...skills);
    const avg = skills.reduce((sum, skill) => sum + skill, 0) / skills.length;

    const execMin = execSkills.length > 0 ? Math.min(...execSkills) : 0;
    const execMax = execSkills.length > 0 ? Math.max(...execSkills) : 0;
    const execAvg = execSkills.length > 0
      ? execSkills.reduce((sum, skill) => sum + skill, 0) / execSkills.length
      : 0;

    return {
      min, max, avg: Math.round(avg * 10) / 10,
      execMin, execMax, execAvg: Math.round(execAvg * 10) / 10
    };
  }, [players]);

  // Skill Group Logic
  const getSkillGroupThresholds = useCallback((playersList: Player[]) => {
    if (playersList.length === 0) return { elite: 8, good: 6, mid: 4, beginner: 2 };

    const sortedSkills = playersList
      .map(p => getEffectiveSkillRating(p))
      .sort((a, b) => b - a);

    const getPercentile = (percentile: number) => {
      const index = Math.floor((percentile / 100) * sortedSkills.length);
      return sortedSkills[Math.min(index, sortedSkills.length - 1)] ?? 0;
    };

    return {
      elite: getPercentile(10),
      good: getPercentile(30),
      mid: getPercentile(60),
      beginner: getPercentile(80)
    };
  }, []);

  const thresholds = useMemo(() => getSkillGroupThresholds(players), [players, getSkillGroupThresholds]);

  const getSkillGroup = useCallback((player: Player) => {
    const skill = getEffectiveSkillRating(player);
    if (skill >= (thresholds.elite ?? 8)) return 'Elite';
    if (skill >= (thresholds.good ?? 6)) return 'Good';
    if (skill >= (thresholds.mid ?? 4)) return 'Mid';
    if (skill >= (thresholds.beginner ?? 2)) return 'Beginner';
    return 'Learning';
  }, [thresholds]);

  const getSkillGroupInfo = useCallback((group: string) => {
    switch (group) {
      case 'Elite':
        return {
          name: 'Elite',
          description: `Top 10% (${(thresholds.elite ?? 8).toFixed(1)}+)`,
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-800',
          borderColor: 'border-purple-200'
        };
      case 'Good':
        return {
          name: 'Good',
          description: `70th-90th percentile (${(thresholds.good ?? 6).toFixed(1)}-${((thresholds.elite ?? 8) - 0.1).toFixed(1)})`,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200'
        };
      case 'Mid':
        return {
          name: 'Mid',
          description: `40th-70th percentile (${(thresholds.mid ?? 4).toFixed(1)}-${((thresholds.good ?? 6) - 0.1).toFixed(1)})`,
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200'
        };
      case 'Beginner':
        return {
          name: 'Beginner',
          description: `20th-40th percentile (${(thresholds.beginner ?? 2).toFixed(1)}-${((thresholds.mid ?? 4) - 0.1).toFixed(1)})`,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200'
        };
      case 'Learning':
        return {
          name: 'Learning',
          description: `Bottom 20% (below ${(thresholds.beginner ?? 2).toFixed(1)})`,
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          borderColor: 'border-orange-200'
        };
      default:
        return {
          name: group,
          description: 'Unknown skill level',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200'
        };
    }
  }, [thresholds]);

  const getSkillGradientStyle = useCallback((skillRating: number) => {
    const normalizedSkill = Math.max(0, Math.min(10, skillRating)) / 10;
    const red = Math.round(22 + (255 - 22) * (1 - normalizedSkill));
    const green = Math.round(101 + (255 - 101) * (1 - normalizedSkill));
    const blue = Math.round(52 + (255 - 52) * (1 - normalizedSkill));
    return {
      backgroundColor: `rgb(${red}, ${green}, ${blue})`,
      color: normalizedSkill > 0.4 ? 'white' : 'black'
    };
  }, []);

  // Filtering
  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      // Search
      if (filters.search && !player.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      // Gender
      if (filters.gender !== 'all' && player.gender !== filters.gender) {
        return false;
      }
      // Skill Range
      if (player.skillRating < filters.minSkill || player.skillRating > filters.maxSkill) {
        return false;
      }
      // Exec Skill Range
      if (filters.minExecSkill > 0 || filters.maxExecSkill < 10) {
        const exec = player.execSkillRating ?? 0;
        if (exec < filters.minExecSkill || exec > filters.maxExecSkill) {
          return false;
        }
      }
      // Skill Groups
      if (filters.skillGroups.length > 0) {
        const group = getSkillGroup(player);
        if (!filters.skillGroups.includes(group)) {
          return false;
        }
      }
      // Email
      if (filters.hasEmail !== null) {
        const hasEmail = !!player.email;
        if (filters.hasEmail !== hasEmail) return false;
      }
      // Requests
      if (filters.hasRequests !== null) {
        const hasRequests = player.teammateRequests.length > 0 || player.avoidRequests.length > 0;
        if (filters.hasRequests !== hasRequests) return false;
      }

      return true;
    });
  }, [players, filters, getSkillGroup]);

  // Handlers
  const generatePlayerId = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substr(2, 5);
  };

  const handleAddPlayer = () => {
    if (!newPlayer.name.trim()) {
      toast.error('Player name is required');
      return;
    }

    const nameExists = players.some(p => p.name.toLowerCase() === newPlayer.name.toLowerCase());
    if (nameExists) {
      toast.error('A player with this name already exists');
      return;
    }

    const player: Player = {
      id: generatePlayerId(newPlayer.name),
      name: newPlayer.name.trim(),
      gender: newPlayer.gender,
      skillRating: newPlayer.skillRating,
      execSkillRating: null,
      teammateRequests: newPlayer.teammateRequests.split(',').map(s => s.trim()).filter(Boolean),
      avoidRequests: newPlayer.avoidRequests.split(',').map(s => s.trim()).filter(Boolean),
      ...(newPlayer.email.trim() && { email: newPlayer.email.trim() })
    };

    if (onPlayerAdd) {
      onPlayerAdd(player);
      setIsAddPlayerOpen(false);
      setNewPlayer({
        name: '',
        gender: 'Other',
        skillRating: 5,
        teammateRequests: '',
        avoidRequests: '',
        email: ''
      });
      toast.success('Player added successfully');
    }
  };

  const handleExportRosters = () => {
    const headers = ['Name', 'Gender', 'Skill Rating', 'Exec Skill Rating', 'Skill Group', 'Teammate Requests', 'Avoid Requests', 'Email'];
    const csvContent = [
      headers.join(','),
      ...players.map(player => [
        `"${player.name}"`,
        player.gender,
        player.skillRating,
        player.execSkillRating || '',
        getSkillGroup(player),
        `"${player.teammateRequests.join('; ')}"`,
        `"${player.avoidRequests.join('; ')}"`,
        `"${player.email || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `player_roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Player roster exported successfully');
  };

  const handleDeleteAllPlayers = () => {
    if (onPlayerRemove && players.length > 0) {
      players.forEach(player => onPlayerRemove(player.id));
      setIsDeleteAllOpen(false);
      toast.success(`All ${players.length} players removed`);
    }
  };

  const handleBulkDelete = () => {
    if (onPlayerRemove && selectedPlayerIds.size > 0) {
      selectedPlayerIds.forEach(id => onPlayerRemove(id));
      setSelectedPlayerIds(new Set());
      toast.success(`${selectedPlayerIds.size} players removed`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-8">
        {/* Total Players */}
        <Card className="border-b-4 border-blue-200 shadow-sm hover:translate-y-[-2px] transition-transform">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="bg-blue-100 p-3 rounded-full mb-2">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div className="text-3xl font-extrabold text-blue-600">{players.length}</div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mt-1">Total Athletes</div>
          </CardContent>
        </Card>

        {/* Gender Split */}
        <Card className="border-b-4 border-pink-200 shadow-sm hover:translate-y-[-2px] transition-transform">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="flex items-end gap-3 mb-2">
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-blue-500">{getGenderStats.M}</span>
                <span className="text-[10px] font-bold text-blue-300 uppercase">Men</span>
              </div>
              <div className="h-8 w-px bg-slate-200 mx-1"></div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-pink-500">{getGenderStats.F}</span>
                <span className="text-[10px] font-bold text-pink-300 uppercase">Women</span>
              </div>
            </div>
            <div className="text-xs font-bold text-pink-400 uppercase tracking-wider mt-1">Gender Split</div>
          </CardContent>
        </Card>

        {/* Avg Skill */}
        <Card className="border-b-4 border-purple-200 shadow-sm hover:translate-y-[-2px] transition-transform">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="bg-purple-100 p-3 rounded-full mb-2">
              <Zap className="h-6 w-6 text-purple-500" />
            </div>
            <div className="text-3xl font-extrabold text-purple-600">{getSkillStats.avg}</div>
            <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mt-1">Avg Skill</div>
          </CardContent>
        </Card>

        {/* Skill Range */}
        <Card className="border-b-4 border-orange-200 shadow-sm hover:translate-y-[-2px] transition-transform">
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">{getSkillStats.min}</span>
              <span className="text-orange-300 font-bold">-</span>
              <span className="text-xl font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">{getSkillStats.max}</span>
            </div>
            <div className="text-xs font-bold text-orange-400 uppercase tracking-wider mt-1">Skill Range</div>
          </CardContent>
        </Card>
      </div>

      {/* Skill Distribution Chart */}
      <SkillDistributionChart players={players} />

      {/* Main Content: Toolbar & Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">

          {/* Search & Stats Summary */}
          <div className="flex-1 w-full md:w-auto relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search players..."
              className="pl-10 bg-white border-slate-200 focus-visible:ring-primary rounded-xl"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <RosterFilters
              filters={filters}
              onFilterChange={setFilters}
              skillGroups={['Elite', 'Good', 'Mid', 'Beginner', 'Learning']}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl border-2 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                  <Settings2 className="h-4 w-4" />
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

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white border-b-4 border-primary-shadow active:border-b-0 rounded-xl font-bold transition-all active:translate-y-1">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Add Player</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                {/* ... (Dialog Content - Keeping existing logic but ensuring it matches) ... */}
                <DialogHeader>
                  <DialogTitle>Add New Player</DialogTitle>
                  <DialogDescription>Add a new player to your roster manually.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newPlayer.name}
                      onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                      placeholder="Enter player name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={newPlayer.gender} onValueChange={(value: Gender) => setNewPlayer({ ...newPlayer, gender: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="skill">Skill Rating (0-10)</Label>
                    <Input
                      id="skill"
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={newPlayer.skillRating}
                      onChange={(e) => setNewPlayer({ ...newPlayer, skillRating: parseFloat(e.target.value) || 5 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newPlayer.email}
                      onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                      placeholder="player@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="teammates">Teammate Requests (Optional)</Label>
                    <Textarea
                      id="teammates"
                      value={newPlayer.teammateRequests}
                      onChange={(e) => setNewPlayer({ ...newPlayer, teammateRequests: e.target.value })}
                      placeholder="Comma-separated list of player names"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="avoid">Avoid Requests (Optional)</Label>
                    <Textarea
                      id="avoid"
                      value={newPlayer.avoidRequests}
                      onChange={(e) => setNewPlayer({ ...newPlayer, avoidRequests: e.target.value })}
                      placeholder="Comma-separated list of player names"
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddPlayerOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddPlayer}>Add Player</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl border-2 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-2 border-slate-100">
                <DropdownMenuLabel>Roster Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportRosters} disabled={players.length === 0} className="cursor-pointer">
                  <Download className="h-4 w-4 mr-2" /> Export to CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <Dialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
                  <DialogTrigger asChild>
                    <div className="w-full"> {/* Trigger wrapper */}
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        disabled={players.length === 0}
                        className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete All
                      </DropdownMenuItem>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                          <AlertTriangle className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-xl">Delete All Players?</DialogTitle>
                      </div>
                      <DialogDescription className="text-base pt-2">
                        This will permanently delete <span className="font-bold text-foreground">{players.length} players</span> from your roster.
                        <br /><br />
                        This action cannot be undone. Are you absolutely sure?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" onClick={() => setIsDeleteAllOpen(false)} className="h-10 rounded-xl font-bold">Cancel</Button>
                      <Button variant="destructive" onClick={handleDeleteAllPlayers} className="h-10 rounded-xl font-bold bg-red-600 hover:bg-red-700">
                        Yes, Delete All
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>

        <div className="p-0">
          {/* Filters */}


          {/* Bulk Actions Bar */}
          {selectedPlayerIds.size > 0 && (
            <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md border animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Badge variant="default">{selectedPlayerIds.size} Selected</Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedPlayerIds.size === 1 ? 'player' : 'players'} selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <RosterTable
            players={filteredPlayers}
            selectedPlayerIds={selectedPlayerIds}
            onSelectionChange={setSelectedPlayerIds}
            onPlayerUpdate={onPlayerUpdate}
            onPlayerRemove={(player) => onPlayerRemove?.(player.id)}
            onViewPlayer={setViewPlayer}
            onEditPlayer={setEditPlayer}
            getSkillGroup={getSkillGroup}
            getSkillGroupInfo={getSkillGroupInfo}
            getSkillGradientStyle={getSkillGradientStyle}
            columnVisibility={columnVisibility}
          />
        </div>
      </div>



      {/* View Player Dialog */}
      <Dialog open={!!viewPlayer} onOpenChange={(open) => !open && setViewPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Player Details</DialogTitle>
          </DialogHeader>
          {viewPlayer && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <div className="font-medium">{viewPlayer.name}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Gender</Label>
                  <div className="font-medium">{viewPlayer.gender}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Skill Rating</Label>
                  <div className="font-medium flex items-center gap-2">
                    <Badge variant="outline" style={getSkillGradientStyle(viewPlayer.skillRating)}>
                      {viewPlayer.skillRating}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Exec Rating</Label>
                  <div className="font-medium">
                    {viewPlayer.execSkillRating ? (
                      <Badge variant="outline" style={getSkillGradientStyle(viewPlayer.execSkillRating)}>
                        {viewPlayer.execSkillRating}
                      </Badge>
                    ) : 'N/A'}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Group</Label>
                  <div className="font-medium">
                    <Badge className={`${getSkillGroupInfo(getSkillGroup(viewPlayer)).bgColor} ${getSkillGroupInfo(getSkillGroup(viewPlayer)).textColor}`}>
                      {getSkillGroup(viewPlayer)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="font-medium">{viewPlayer.email || '-'}</div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Teammate Requests</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {viewPlayer.teammateRequests.length > 0 ? (
                    viewPlayer.teammateRequests.map((req, i) => (
                      <Badge key={i} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <UserCheck className="h-3 w-3 mr-1" /> {req}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Avoid Requests</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {viewPlayer.avoidRequests.length > 0 ? (
                    viewPlayer.avoidRequests.map((req, i) => (
                      <Badge key={i} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <UserMinus className="h-3 w-3 mr-1" /> {req}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Player Dialog (Simplified for now, can be expanded) */}
      <Dialog open={!!editPlayer} onOpenChange={(open) => !open && setEditPlayer(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          {editPlayer && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editPlayer.name}
                  onChange={(e) => setEditPlayer({ ...editPlayer, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={editPlayer.gender}
                    onValueChange={(val: Gender) => setEditPlayer({ ...editPlayer, gender: val })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Skill Rating</Label>
                  <Input
                    type="number"
                    min="0" max="10" step="0.1"
                    value={editPlayer.skillRating}
                    onChange={(e) => setEditPlayer({ ...editPlayer, skillRating: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={editPlayer.email || ''}
                  onChange={(e) => setEditPlayer({ ...editPlayer, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Teammate Requests (comma separated)</Label>
                <Textarea
                  value={editPlayer.teammateRequests.join(', ')}
                  onChange={(e) => setEditPlayer({ ...editPlayer, teammateRequests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <Label>Avoid Requests (comma separated)</Label>
                <Textarea
                  value={editPlayer.avoidRequests.join(', ')}
                  onChange={(e) => setEditPlayer({ ...editPlayer, avoidRequests: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlayer(null)}>Cancel</Button>
            <Button onClick={() => {
              if (editPlayer) {
                onPlayerUpdate(editPlayer);
                setEditPlayer(null);
                toast.success('Player updated');
              }
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
