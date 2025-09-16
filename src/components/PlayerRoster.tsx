import React, { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { Player, Gender, getEffectiveSkillRating } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Users, 
  Search, 
  Filter, 
  Edit, 
  Edit2,
  Eye,
  SortAsc,
  SortDesc,
  UserCheck,
  UserX,
  Download,
  Plus,
  Trash2,
  Check,
  X,
  ChevronsUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { debounce } from '@/utils/performance';
import { validatePlayerName, validateSkillRating } from '@/utils/validation';

interface PlayerRosterProps {
  players: Player[];
  onPlayerUpdate: (player: Player) => void;
  onPlayerAdd?: (player: Player) => void;
  onPlayerRemove?: (playerId: string) => void;
}

type SortField = 'name' | 'gender' | 'skillRating' | 'email';
type SortDirection = 'asc' | 'desc';

export function PlayerRoster({ players, onPlayerUpdate, onPlayerAdd, onPlayerRemove }: PlayerRosterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<Gender | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [skillValue, setSkillValue] = useState('');
  const [editingExecSkill, setEditingExecSkill] = useState<string | null>(null);
  const [execSkillValue, setExecSkillValue] = useState('');
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    gender: 'Other' as Gender,
    skillRating: 5,
    teammateRequests: '',
    avoidRequests: '',
    email: ''
  });

  // Autocomplete state for editing player
  const [teammateSearchOpen, setTeammateSearchOpen] = useState(false);
  const [avoidSearchOpen, setAvoidSearchOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  // Create debounced search handler
  const debouncedSearchRef = useRef(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300)
  );

  // Handle search input change with debouncing
  const handleSearchChange = useCallback((value: string) => {
    setInternalSearchTerm(value);
    debouncedSearchRef.current(value);
  }, []);

  // Split filtering and sorting into separate memos for better performance
  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = genderFilter === 'all' || player.gender === genderFilter;
      return matchesSearch && matchesGender;
    });
  }, [players, searchTerm, genderFilter]);

  const filteredAndSortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'gender':
          aValue = a.gender;
          bValue = b.gender;
          break;
        case 'skillRating':
          aValue = getEffectiveSkillRating(a);
          bValue = getEffectiveSkillRating(b);
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
  }, [filteredPlayers, sortField, sortDirection]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const getSortIcon = useCallback((field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />;
  }, [sortField, sortDirection]);

  const getGenderStats = useMemo(() => {
    const stats = { M: 0, F: 0, Other: 0 };
    players.forEach(player => {
      stats[player.gender]++;
    });
    return stats;
  }, [players]);

  const getSkillStats = () => {
    if (players.length === 0) return { min: 0, max: 0, avg: 0, execMin: 0, execMax: 0, execAvg: 0 };

    const skills = players.map(p => p.skillRating);
    const execSkills = players.map(p => p.execSkillRating).filter(rating => rating !== null) as number[];
    const min = Math.min(...skills);
    const max = Math.max(...skills);
    const avg = skills.reduce((sum, skill) => sum + skill, 0) / skills.length;

    // Only calculate exec stats if we have any exec ratings
    const execMin = execSkills.length > 0 ? Math.min(...execSkills) : 0;
    const execMax = execSkills.length > 0 ? Math.max(...execSkills) : 0;
    const execAvg = execSkills.length > 0
      ? execSkills.reduce((sum, skill) => sum + skill, 0) / execSkills.length
      : 0;

    return {
      min, max, avg: Math.round(avg * 10) / 10,
      execMin, execMax, execAvg: Math.round(execAvg * 10) / 10
    };
  };

  // Calculate skill group thresholds based on player percentiles
  const getSkillGroupThresholds = (players: Player[]) => {
    if (players.length === 0) return { elite: 8, good: 6, mid: 4, beginner: 2 };
    
    // Use exec rating if available, otherwise use skill rating for percentile calculations
    const sortedSkills = players
      .map(p => getEffectiveSkillRating(p))
      .sort((a, b) => b - a);
    const getPercentile = (percentile: number) => {
      const index = Math.floor((percentile / 100) * sortedSkills.length);
      return sortedSkills[Math.min(index, sortedSkills.length - 1)];
    };
    
    return {
      elite: getPercentile(10),    // Top 10% (90th percentile)
      good: getPercentile(30),     // 70th-90th percentile  
      mid: getPercentile(60),      // 40th-70th percentile
      beginner: getPercentile(80)  // 20th-40th percentile
      // Learning: Bottom 20% (0th-20th percentile)
    };
  };

  const getSkillGroup = (player: Player) => {
    const thresholds = getSkillGroupThresholds(players);
    // Use exec rating if available, otherwise use skill rating
    const skill = getEffectiveSkillRating(player);
    
    if (skill >= thresholds.elite) return 'Elite';
    if (skill >= thresholds.good) return 'Good';
    if (skill >= thresholds.mid) return 'Mid';
    if (skill >= thresholds.beginner) return 'Beginner';
    return 'Learning';
  };

  const getSkillGroupInfo = (group: string) => {
    const thresholds = getSkillGroupThresholds(players);
    
    switch (group) {
      case 'Elite':
        return {
          name: 'Elite',
          description: `Top 10% of players (${thresholds.elite.toFixed(1)}+ rating)`,
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-800',
          borderColor: 'border-purple-200'
        };
      case 'Good':
        return {
          name: 'Good',
          description: `70th-90th percentile (${thresholds.good.toFixed(1)}-${(thresholds.elite - 0.1).toFixed(1)} rating)`,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200'
        };
      case 'Mid':
        return {
          name: 'Mid',
          description: `40th-70th percentile (${thresholds.mid.toFixed(1)}-${(thresholds.good - 0.1).toFixed(1)} rating)`,
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200'
        };
      case 'Beginner':
        return {
          name: 'Beginner',
          description: `20th-40th percentile (${thresholds.beginner.toFixed(1)}-${(thresholds.mid - 0.1).toFixed(1)} rating)`,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200'
        };
      case 'Learning':
        return {
          name: 'Learning',
          description: `Bottom 20% of players (below ${thresholds.beginner.toFixed(1)} rating)`,
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
  };

  const SkillGroupBadge = ({ player }: { player: Player }) => {
    const group = getSkillGroup(player);
    const groupInfo = getSkillGroupInfo(group);
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              className={`${groupInfo.bgColor} ${groupInfo.textColor} ${groupInfo.borderColor} border cursor-help font-medium`}
            >
              {groupInfo.name}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-semibold">{groupInfo.name}</div>
              <div className="text-gray-600">{groupInfo.description}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getSkillGradientStyle = (skillRating: number) => {
    const normalizedSkill = Math.max(0, Math.min(10, skillRating)) / 10;
    // Dark green (high skill) to white (low skill) gradient
    // Dark green: rgb(22, 101, 52) -> White: rgb(255, 255, 255)
    const red = Math.round(22 + (255 - 22) * (1 - normalizedSkill));
    const green = Math.round(101 + (255 - 101) * (1 - normalizedSkill));
    const blue = Math.round(52 + (255 - 52) * (1 - normalizedSkill));
    return {
      backgroundColor: `rgb(${red}, ${green}, ${blue})`,
      color: normalizedSkill > 0.4 ? 'white' : 'black'
    };
  };

  const genderStats = getGenderStats;
  const skillStats = getSkillStats();

  const handleExportRosters = () => {
    const headers = ['Name', 'Gender', 'Skill Rating', 'Exec Skill Rating', 'Skill Group', 'Teammate Requests', 'Avoid Requests'];
    const csvContent = [
      headers.join(','),
      ...players.map(player => [
        `"${player.name}"`,
        player.gender,
        player.skillRating,
        player.execSkillRating,
        getSkillGroup(player),
        `"${player.teammateRequests.join('; ')}"`,
        `"${player.avoidRequests.join('; ')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `player_roster_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Player roster exported successfully');
  };

  // Create debounced skill update handler
  const debouncedSkillUpdateRef = useRef(
    debounce((player: Player, skillRating: number) => {
      onPlayerUpdate({ ...player, skillRating });
      toast.success('Skill rating updated');
    }, 500)
  );

  // Create debounced exec skill update handler
  const debouncedExecSkillUpdateRef = useRef(
    debounce((player: Player, execSkillRating: number | null) => {
      onPlayerUpdate({ ...player, execSkillRating });
      toast.success('Exec skill rating updated');
    }, 500)
  );

  const handleSkillEdit = useCallback((player: Player, newValue: string) => {
    const skillRating = validateSkillRating(parseFloat(newValue) || 0);
    setSkillValue(skillRating.toString());
    debouncedSkillUpdateRef.current(player, skillRating);
    setEditingSkill(null);
  }, []);

  const handleExecSkillEdit = useCallback((player: Player, newValue: string) => {
    const execSkillRating = newValue ? validateSkillRating(parseFloat(newValue) || 0) : null;
    setExecSkillValue(execSkillRating !== null ? execSkillRating.toString() : '');
    debouncedExecSkillUpdateRef.current(player, execSkillRating);
    setEditingExecSkill(null);
  }, []);

  const handleSkillKeyDown = useCallback((e: React.KeyboardEvent, player: Player, value: string) => {
    if (e.key === 'Enter') {
      handleSkillEdit(player, value);
    } else if (e.key === 'Escape') {
      setEditingSkill(null);
    }
  }, [handleSkillEdit]);

  const generatePlayerId = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substr(2, 5);
  };

  const handleAddPlayer = useCallback(() => {
    if (!newPlayer.name.trim()) {
      toast.error('Player name is required');
      return;
    }

    // Check for duplicate names
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
      execSkillRating: null, // New players start with N/A
      teammateRequests: newPlayer.teammateRequests
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0),
      avoidRequests: newPlayer.avoidRequests
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0),
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
  }, [newPlayer, players, onPlayerAdd]);

  const handleRemovePlayer = useCallback((player: Player) => {
    if (onPlayerRemove) {
      onPlayerRemove(player.id);
      toast.success(`${player.name} removed from roster`);
    }
  }, [onPlayerRemove]);

  const handleDeleteAllPlayers = useCallback(() => {
    if (onPlayerRemove && players.length > 0) {
      // Remove all players one by one
      players.forEach(player => {
        onPlayerRemove(player.id);
      });
      setIsDeleteAllOpen(false);
      toast.success(`All ${players.length} players removed from roster`);
    }
  }, [onPlayerRemove, players]);

  // Helper functions for autocomplete
  const getAvailablePlayersForTeammate = (currentPlayer: Player) => {
    return players.filter(p => 
      p.id !== currentPlayer.id && 
      !currentPlayer.teammateRequests.includes(p.name)
    );
  };

  const getAvailablePlayersForAvoid = (currentPlayer: Player) => {
    return players.filter(p => 
      p.id !== currentPlayer.id && 
      !currentPlayer.avoidRequests.includes(p.name)
    );
  };

  const addTeammateRequest = (playerName: string) => {
    if (editingPlayer && !editingPlayer.teammateRequests.includes(playerName)) {
      setEditingPlayer({
        ...editingPlayer,
        teammateRequests: [...editingPlayer.teammateRequests, playerName]
      });
    }
    setTeammateSearchOpen(false);
  };

  const removeTeammateRequest = (playerName: string) => {
    if (editingPlayer) {
      setEditingPlayer({
        ...editingPlayer,
        teammateRequests: editingPlayer.teammateRequests.filter(name => name !== playerName)
      });
    }
  };

  const addAvoidRequest = (playerName: string) => {
    if (editingPlayer && !editingPlayer.avoidRequests.includes(playerName)) {
      setEditingPlayer({
        ...editingPlayer,
        avoidRequests: [...editingPlayer.avoidRequests, playerName]
      });
    }
    setAvoidSearchOpen(false);
  };

  const removeAvoidRequest = (playerName: string) => {
    if (editingPlayer) {
      setEditingPlayer({
        ...editingPlayer,
        avoidRequests: editingPlayer.avoidRequests.filter(name => name !== playerName)
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Player Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{players.length}</div>
            <div className="text-sm text-gray-600">Total Players</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-semibold text-green-600">
              {genderStats.M}M / {genderStats.F}F
            </div>
            <div className="text-sm text-gray-600">Gender Split</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{skillStats.avg}</div>
            <div className="text-sm text-gray-600">Avg Skill Rating</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-semibold text-orange-600">
              {skillStats.min} - {skillStats.max}
            </div>
            <div className="text-sm text-gray-600">Skill Range</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Player Roster ({filteredAndSortedPlayers.length} of {players.length})
              </CardTitle>
              <CardDescription>
                View and edit player information
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Roster Player
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Player</DialogTitle>
                    <DialogDescription>
                      Add a new player to your roster manually.
                    </DialogDescription>
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
                    <Button variant="outline" onClick={() => setIsAddPlayerOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddPlayer}>
                      Add Player
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                onClick={handleExportRosters}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                disabled={players.length === 0}
              >
                <Download className="h-4 w-4" />
                Export Rosters
              </Button>
              {onPlayerRemove && (
                <Dialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={players.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete All Players
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete All Players</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete all {players.length} players from the roster? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteAllOpen(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDeleteAllPlayers}>
                        Delete All Players
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search players..."
                value={internalSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={genderFilter} onValueChange={(value) => setGenderFilter(value as Gender | 'all')}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="M">Male</SelectItem>
                <SelectItem value="F">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Player Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 select-none w-[20%] px-2"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1 text-xs">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 select-none w-[8%] px-2"
                    onClick={() => handleSort('gender')}
                  >
                    <div className="flex items-center gap-1 text-xs">
                      <span className="hidden sm:inline">Gender</span>
                      <span className="sm:hidden">Gen</span>
                      {getSortIcon('gender')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 select-none w-[8%] px-2"
                    onClick={() => handleSort('skillRating')}
                  >
                    <div className="flex items-center gap-1 text-xs">
                      <span className="hidden sm:inline">Skill</span>
                      <span className="sm:hidden">Skl</span>
                      {getSortIcon('skillRating')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[8%] px-2 text-xs">
                    <span className="hidden sm:inline">Exec</span>
                    <span className="sm:hidden">Ex</span>
                  </TableHead>
                  <TableHead className="w-[8%] px-2 text-xs">
                    <span className="hidden sm:inline">Group</span>
                    <span className="sm:hidden">Grp</span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50 select-none w-[14%] px-2 hidden md:table-cell"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1 text-xs">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[12%] px-2 text-xs">
                    <span className="hidden sm:inline">Teammates</span>
                    <span className="sm:hidden">TM</span>
                  </TableHead>
                  <TableHead className="w-[10%] px-2 text-xs">
                    <span className="hidden sm:inline">Avoid</span>
                    <span className="sm:hidden">Av</span>
                  </TableHead>
                  <TableHead className="w-[12%] px-2 text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedPlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{player.gender}</Badge>
                    </TableCell>
                    <TableCell>
                      {editingSkill === player.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={skillValue}
                            onChange={(e) => setSkillValue(e.target.value)}
                            className="w-20"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleSkillEdit(player, skillValue);
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSkillEdit(player, skillValue)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingSkill(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 cursor-pointer p-1 rounded"
                          style={getSkillGradientStyle(player.skillRating)}
                          onClick={() => {
                            setEditingSkill(player.id);
                            setSkillValue(player.skillRating.toString());
                          }}
                        >
                          <span className="font-medium">{player.skillRating}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Edit2 className="h-3 w-3 opacity-60" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Skill: {player.skillRating} | Exec: {player.execSkillRating ?? 'N/A'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingExecSkill === player.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={execSkillValue}
                            onChange={(e) => setExecSkillValue(e.target.value)}
                            className="w-20"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleExecSkillEdit(player, execSkillValue);
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExecSkillEdit(player, execSkillValue)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingExecSkill(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 cursor-pointer p-1 rounded min-h-[32px]"
                          style={player.execSkillRating !== null ? getSkillGradientStyle(player.execSkillRating) : {}}
                          onClick={() => {
                            setEditingExecSkill(player.id);
                            setExecSkillValue(player.execSkillRating !== null ? player.execSkillRating.toString() : '');
                          }}
                        >
                          <span className="font-medium">
                            {player.execSkillRating !== null ? player.execSkillRating : 'N/A'}
                          </span>
                          <Edit2 className="h-3 w-3 opacity-60" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <SkillGroupBadge player={player} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {player.email ? (
                        <a 
                          href={`mailto:${player.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {player.email}
                        </a>
                      ) : (
                        <span className="text-gray-400">No email</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {player.teammateRequests.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3 text-green-600" />
                          {player.teammateRequests.join(', ')}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {player.avoidRequests.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <UserX className="h-3 w-3 text-red-600" />
                          {player.avoidRequests.join(', ')}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPlayer(player)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPlayer({ ...player })}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        {onPlayerRemove && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemovePlayer(player)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredAndSortedPlayers.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {searchTerm || genderFilter !== 'all' 
                  ? 'No players match your filters'
                  : 'No players found'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Player Detail Modal */}
      <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Player Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedPlayer?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlayer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <div className="text-lg font-semibold">{selectedPlayer.name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Gender</label>
                  <div><Badge variant="outline">{selectedPlayer.gender}</Badge></div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Skill Rating</label>
                  <div className="text-lg font-semibold">{selectedPlayer.skillRating}/10</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Team Assignment</label>
                  <div>{selectedPlayer.teamId ? 'Assigned' : 'Unassigned'}</div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Teammate Requests</label>
                <div className="mt-1">
                  {selectedPlayer.teammateRequests.length > 0 ? (
                    <div className="space-y-1">
                      {selectedPlayer.teammateRequests.map((name, index) => (
                        <Badge key={index} variant="secondary" className="mr-2">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Avoid Requests</label>
                <div className="mt-1">
                  {selectedPlayer.avoidRequests.length > 0 ? (
                    <div className="space-y-1">
                      {selectedPlayer.avoidRequests.map((name, index) => (
                        <Badge key={index} variant="destructive" className="mr-2">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Player Edit Modal */}
      <Dialog open={!!editingPlayer} onOpenChange={() => setEditingPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>
              Modify player information
            </DialogDescription>
          </DialogHeader>
          
          {editingPlayer && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Skill Rating (0-10)</label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={editingPlayer.skillRating}
                  onChange={(e) => setEditingPlayer({
                    ...editingPlayer,
                    skillRating: parseFloat(e.target.value) || 0
                  })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Exec Skill Rating (0-10)</label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={editingPlayer.execSkillRating !== null ? editingPlayer.execSkillRating : ''}
                  onChange={(e) => setEditingPlayer({
                    ...editingPlayer,
                    execSkillRating: e.target.value ? parseFloat(e.target.value) : null
                  })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Teammate Requests</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editingPlayer.teammateRequests.map((name, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer">
                      {name}
                      <X 
                        className="h-3 w-3 ml-1 hover:text-red-600" 
                        onClick={() => removeTeammateRequest(name)}
                      />
                    </Badge>
                  ))}
                </div>
                <Popover open={teammateSearchOpen} onOpenChange={setTeammateSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={teammateSearchOpen}
                      className="w-full justify-between"
                    >
                      Add teammate request...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search players..." />
                      <CommandList>
                        <CommandEmpty>No players found.</CommandEmpty>
                        <CommandGroup>
                          {getAvailablePlayersForTeammate(editingPlayer).map((player) => (
                            <CommandItem
                              key={player.id}
                              value={player.name}
                              onSelect={() => addTeammateRequest(player.name)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 opacity-0`}
                              />
                              {player.name}
                              <Badge variant="outline" className="ml-auto">
                                {player.gender}
                              </Badge>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Avoid Requests</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editingPlayer.avoidRequests.map((name, index) => (
                    <Badge key={index} variant="destructive" className="cursor-pointer">
                      {name}
                      <X 
                        className="h-3 w-3 ml-1 hover:text-red-800" 
                        onClick={() => removeAvoidRequest(name)}
                      />
                    </Badge>
                  ))}
                </div>
                <Popover open={avoidSearchOpen} onOpenChange={setAvoidSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={avoidSearchOpen}
                      className="w-full justify-between"
                    >
                      Add avoid request...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search players..." />
                      <CommandList>
                        <CommandEmpty>No players found.</CommandEmpty>
                        <CommandGroup>
                          {getAvailablePlayersForAvoid(editingPlayer).map((player) => (
                            <CommandItem
                              key={player.id}
                              value={player.name}
                              onSelect={() => addAvoidRequest(player.name)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 opacity-0`}
                              />
                              {player.name}
                              <Badge variant="outline" className="ml-auto">
                                {player.gender}
                              </Badge>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => {
                    onPlayerUpdate(editingPlayer);
                    setEditingPlayer(null);
                    toast.success('Player updated successfully');
                  }}
                  className="flex-1"
                >
                  Save Changes
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingPlayer(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
