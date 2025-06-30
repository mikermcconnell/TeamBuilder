import React, { useState, useMemo } from 'react';
import { Player, Gender } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Users, 
  Search, 
  Filter, 
  Edit, 
  Eye,
  SortAsc,
  SortDesc,
  UserCheck,
  UserX,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface PlayerRosterProps {
  players: Player[];
  onPlayerUpdate: (player: Player) => void;
}

type SortField = 'name' | 'gender' | 'skillRating' | 'email';
type SortDirection = 'asc' | 'desc';

export function PlayerRoster({ players, onPlayerUpdate }: PlayerRosterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<Gender | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = players.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = genderFilter === 'all' || player.gender === genderFilter;
      return matchesSearch && matchesGender;
    });

    return filtered.sort((a, b) => {
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
          aValue = a.skillRating;
          bValue = b.skillRating;
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
  }, [players, searchTerm, genderFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />;
  };

  const getGenderStats = () => {
    const stats = { M: 0, F: 0, Other: 0 };
    players.forEach(player => {
      stats[player.gender]++;
    });
    return stats;
  };

  const getSkillStats = () => {
    if (players.length === 0) return { min: 0, max: 0, avg: 0 };
    
    const skills = players.map(p => p.skillRating);
    const min = Math.min(...skills);
    const max = Math.max(...skills);
    const avg = skills.reduce((sum, skill) => sum + skill, 0) / skills.length;
    
    return { min, max, avg: Math.round(avg * 10) / 10 };
  };

  const getSkillGroup = (player: Player) => {
    if (players.length === 0) return 'Unknown';
    
    const skills = players.map(p => p.skillRating).sort((a, b) => b - a);
    const playerSkill = player.skillRating;
    const playerRank = skills.findIndex(skill => skill <= playerSkill) + 1;
    const percentile = (playerRank / skills.length) * 100;
    
    if (percentile <= 10) return 'Elite';
    if (percentile <= 30) return 'Good';
    if (percentile <= 60) return 'Mid';
    if (percentile <= 80) return 'Beginner';
    return 'Learning';
  };

  const getSkillGroupColor = (group: string) => {
    switch (group) {
      case 'Elite': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Good': return 'bg-green-100 text-green-800 border-green-200';
      case 'Mid': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Beginner': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Learning': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

  const genderStats = getGenderStats();
  const skillStats = getSkillStats();

  const handleExportRosters = () => {
    const headers = ['Name', 'Gender', 'Skill Rating', 'Skill Group', 'Teammate Requests', 'Avoid Requests'];
    const csvContent = [
      headers.join(','),
      ...players.map(player => [
        `"${player.name}"`,
        player.gender,
        player.skillRating,
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

  const handleSkillEdit = (player: Player, newValue: string) => {
    const skillRating = Math.min(10, Math.max(0, parseFloat(newValue) || 0));
    onPlayerUpdate({ ...player, skillRating });
    setEditingSkill(null);
    toast.success('Skill rating updated');
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent, player: Player, value: string) => {
    if (e.key === 'Enter') {
      handleSkillEdit(player, value);
    } else if (e.key === 'Escape') {
      setEditingSkill(null);
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
              {genderStats.M}M / {genderStats.F}F / {genderStats.Other}O
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
            <Button
              onClick={handleExportRosters}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              disabled={players.length === 0}
            >
              <Download className="h-4 w-4" />
              Export Rosters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50 select-none"
                    onClick={() => handleSort('gender')}
                  >
                    <div className="flex items-center gap-2">
                      Gender
                      {getSortIcon('gender')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50 select-none"
                    onClick={() => handleSort('skillRating')}
                  >
                    <div className="flex items-center gap-2">
                      Skill Rating
                      {getSortIcon('skillRating')}
                    </div>
                  </TableHead>
                  <TableHead>Skill Group</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50 select-none"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead>Teammate Requests</TableHead>
                  <TableHead>Avoid Requests</TableHead>
                  <TableHead>Actions</TableHead>
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
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          className="w-20 h-8 text-sm"
                          defaultValue={player.skillRating}
                          autoFocus
                          onBlur={(e) => handleSkillEdit(player, e.target.value)}
                          onKeyDown={(e) => handleSkillKeyDown(e, player, (e.target as HTMLInputElement).value)}
                        />
                      ) : (
                        <Badge 
                          className="cursor-pointer hover:opacity-80 border-0"
                          style={getSkillGradientStyle(player.skillRating)}
                          onClick={() => setEditingSkill(player.id)}
                        >
                          {player.skillRating}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={getSkillGroupColor(getSkillGroup(player))}
                      >
                        {getSkillGroup(player)}
                      </Badge>
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
                <label className="text-sm font-medium text-gray-600">Teammate Requests (comma-separated)</label>
                <Input
                  placeholder="Enter names separated by commas"
                  value={editingPlayer.teammateRequests.join(', ')}
                  onChange={(e) => setEditingPlayer({
                    ...editingPlayer,
                    teammateRequests: e.target.value
                      .split(',')
                      .map(name => name.trim())
                      .filter(name => name.length > 0)
                  })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-600">Avoid Requests (comma-separated)</label>
                <Input
                  placeholder="Enter names separated by commas"
                  value={editingPlayer.avoidRequests.join(', ')}
                  onChange={(e) => setEditingPlayer({
                    ...editingPlayer,
                    avoidRequests: e.target.value
                      .split(',')
                      .map(name => name.trim())
                      .filter(name => name.length > 0)
                  })}
                />
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
