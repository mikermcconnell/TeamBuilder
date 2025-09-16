import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  Save, 
  FolderOpen, 
  Cloud, 
  Archive,
  Copy,
  Trash2,
  Clock,
  Download,
  Upload,
  Search,
  Filter,
  Tag,
  Users,
  FileJson,
  MoreVertical,
  Star,
  Share2,
  Grid3X3,
  List,
  Eye,
  Edit,
  ChevronRight,
  Database,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Player, PlayerGroup } from '@/types';
import { 
  saveRoster, 
  getUserRosters, 
  deleteRoster,
  RosterData,
  updateRoster,
  getRoster,
  archiveRoster,
  duplicateRoster,
  exportRosterToJSON,
  importRosterFromJSON,
  getRecentRosters,
  searchRosters
} from '@/services/rosterService';

interface RosterManagerProps {
  players: Player[];
  playerGroups: PlayerGroup[];
  user: User | null;
  onLoadRoster: (
    players: Player[], 
    playerGroups: PlayerGroup[], 
    rosterId?: string,
    teams?: any[], 
    unassignedPlayers?: Player[], 
    teamsConfig?: any
  ) => void;
}

export function RosterManager({ players, playerGroups, user, onLoadRoster }: RosterManagerProps) {
  const [rosters, setRosters] = useState<RosterData[]>([]);
  const [recentRosters, setRecentRosters] = useState<RosterData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedRoster, setSelectedRoster] = useState<RosterData | null>(null);
  const [currentRosterId, setCurrentRosterId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSport, setFilterSport] = useState<string>('all');
  const [filterSeason, setFilterSeason] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  
  // Form fields for saving
  const [rosterName, setRosterName] = useState('');
  const [rosterDescription, setRosterDescription] = useState('');
  const [rosterSport, setRosterSport] = useState('');
  const [rosterSeason, setRosterSeason] = useState('');
  const [rosterTags, setRosterTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Load user rosters when user changes
  useEffect(() => {
    if (user) {
      loadUserRosters(user.uid);
      loadRecentRosters(user.uid);
    } else {
      setRosters([]);
      setRecentRosters([]);
    }
  }, [user, showArchived]);

  const loadUserRosters = async (userId: string) => {
    try {
      const userRosters = await getUserRosters(userId, showArchived);
      setRosters(userRosters);
      
      // Clear any index building messages if successful
      if (userRosters.length > 0 || !sessionStorage.getItem('indexBuildingNotified')) {
        sessionStorage.removeItem('indexBuildingNotified');
      }
    } catch (error: any) {
      console.error('Error loading rosters:', error);
      
      // Show user-friendly message for index building
      if (error?.message?.includes('index') && !sessionStorage.getItem('indexBuildingNotified')) {
        toast.info('Database is being optimized. Your rosters will be available in a few minutes.', {
          duration: 10000
        });
        sessionStorage.setItem('indexBuildingNotified', 'true');
      }
    }
  };

  const loadRecentRosters = async (userId: string) => {
    try {
      const recent = await getRecentRosters(userId, 3);
      setRecentRosters(recent);
    } catch (error) {
      console.error('Error loading recent rosters:', error);
    }
  };

  const handleSaveRoster = async () => {
    if (!user) {
      toast.error('Please sign in to save rosters');
      return;
    }

    if (!rosterName.trim()) {
      toast.error('Please enter a roster name');
      return;
    }

    if (players.length === 0) {
      toast.error('Cannot save an empty roster');
      return;
    }

    setIsLoading(true);
    try {
      const rosterData: Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'> = {
        userId: user.uid,
        name: rosterName,
        description: rosterDescription,
        players: players,
        playerGroups: playerGroups,
        sport: rosterSport,
        season: rosterSeason,
        tags: rosterTags
      };

      if (currentRosterId) {
        // Update existing roster
        await updateRoster(currentRosterId, rosterData, true);
        toast.success('Roster updated successfully (new version created)');
      } else {
        // Save new roster
        const rosterId = await saveRoster(rosterData);
        setCurrentRosterId(rosterId);
        toast.success('Roster saved successfully');
      }
      
      await loadUserRosters(user.uid);
      await loadRecentRosters(user.uid);
      setShowSaveDialog(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save roster');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadRoster = async (roster: RosterData) => {
    setIsLoading(true);
    try {
      // Get the full roster data (updates last accessed time)
      const fullRoster = await getRoster(roster.id!);
      if (fullRoster) {
        // Load roster with teams if they exist
        onLoadRoster(
          fullRoster.players, 
          fullRoster.playerGroups || [],
          fullRoster.id,
          fullRoster.teams,
          fullRoster.unassignedPlayers,
          fullRoster.teamsConfig
        );
        setCurrentRosterId(fullRoster.id || null);
        setRosterName(fullRoster.name);
        setRosterDescription(fullRoster.description || '');
        setRosterSport(fullRoster.sport || '');
        setRosterSeason(fullRoster.season || '');
        setRosterTags(fullRoster.tags || []);
        setShowLoadDialog(false);
        
        // Show appropriate message based on whether teams exist
        if (fullRoster.teams && fullRoster.teams.length > 0) {
          toast.success(`Loaded roster: ${fullRoster.name} (with ${fullRoster.teams.length} teams)`);
        } else {
          toast.success(`Loaded roster: ${fullRoster.name}`);
        }
      }
    } catch (error) {
      toast.error('Failed to load roster');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRoster = async (rosterId: string) => {
    if (!confirm('Are you sure you want to delete this roster? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteRoster(rosterId);
      if (currentRosterId === rosterId) {
        setCurrentRosterId(null);
        resetForm();
      }
      await loadUserRosters(user!.uid);
      await loadRecentRosters(user!.uid);
      toast.success('Roster deleted');
    } catch (error) {
      toast.error('Failed to delete roster');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveRoster = async (rosterId: string, isArchived: boolean) => {
    setIsLoading(true);
    try {
      await archiveRoster(rosterId, !isArchived);
      await loadUserRosters(user!.uid);
      await loadRecentRosters(user!.uid);
      toast.success(isArchived ? 'Roster unarchived' : 'Roster archived');
    } catch (error) {
      toast.error('Failed to archive roster');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicateRoster = async (rosterId: string, originalName: string) => {
    setIsLoading(true);
    try {
      const newName = `${originalName} (Copy)`;
      await duplicateRoster(rosterId, user!.uid, newName);
      await loadUserRosters(user!.uid);
      toast.success('Roster duplicated successfully');
    } catch (error) {
      toast.error('Failed to duplicate roster');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportRoster = (roster: RosterData) => {
    try {
      const jsonData = exportRosterToJSON(roster);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${roster.name.replace(/[^a-z0-9]/gi, '_')}_roster.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Roster exported successfully');
    } catch (error) {
      toast.error('Failed to export roster');
    }
  };

  const handleImportRoster = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      const imported = await importRosterFromJSON(text, user.uid);
      await loadUserRosters(user.uid);
      toast.success(`Imported roster: ${imported.name}`);
    } catch (error) {
      toast.error('Failed to import roster. Please check the file format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !rosterTags.includes(tagInput.trim())) {
      setRosterTags([...rosterTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setRosterTags(rosterTags.filter(t => t !== tag));
  };

  const resetForm = () => {
    setRosterName('');
    setRosterDescription('');
    setRosterSport('');
    setRosterSeason('');
    setRosterTags([]);
    setTagInput('');
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  const filteredRosters = rosters.filter(roster => {
    const matchesSearch = !searchTerm || 
      roster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roster.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSport = filterSport === 'all' || roster.sport === filterSport;
    const matchesSeason = filterSeason === 'all' || roster.season === filterSeason;
    
    return matchesSearch && matchesSport && matchesSeason;
  });

  const uniqueSports = Array.from(new Set(rosters.map(r => r.sport).filter(Boolean)));
  const uniqueSeasons = Array.from(new Set(rosters.map(r => r.season).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => setShowSaveDialog(true)}
              disabled={players.length === 0}
              className="flex-1 sm:flex-none"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Roster
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowLoadDialog(true)}
              disabled={!user}
              className="flex-1 sm:flex-none"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Load Roster ({rosters.length})
            </Button>
            <label htmlFor="import-roster">
              <Button variant="outline" asChild className="flex-1 sm:flex-none">
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import JSON
                </span>
              </Button>
              <input
                id="import-roster"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportRoster}
                disabled={!user}
              />
            </label>
          </div>

          {/* Current Roster Info */}
          {currentRosterId && (
            <Alert className="mt-4">
              <Database className="h-4 w-4" />
              <AlertDescription>
                Working on: <strong>{rosterName}</strong>
                {rosterTags.length > 0 && (
                  <span className="ml-2">
                    {rosterTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="ml-1">
                        {tag}
                      </Badge>
                    ))}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Recent Rosters */}
          {recentRosters.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm text-gray-600">Recent Rosters</Label>
              <div className="mt-2 space-y-2">
                {recentRosters.map(roster => (
                  <div
                    key={roster.id}
                    className="w-full p-2 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleLoadRoster(roster)}
                        className="flex-1 text-left flex items-center gap-2"
                      >
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{roster.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {roster.metadata?.totalPlayers} players
                        </Badge>
                        {roster.metadata?.hasTeams && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            {roster.metadata?.teamsCount} teams
                          </Badge>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleLoadRoster(roster)}>
                            <Eye className="h-4 w-4 mr-2" /> Load
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSelectedRoster(roster)}>
                            <Eye className="h-4 w-4 mr-2" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateRoster(roster.id!, roster.name)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportRoster(roster)}>
                            <Download className="h-4 w-4 mr-2" /> Export JSON
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleArchiveRoster(roster.id!, roster.isArchived!)}>
                            <Archive className="h-4 w-4 mr-2" /> 
                            {roster.isArchived ? 'Unarchive' : 'Archive'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteRoster(roster.id!)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Roster Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Save Roster</DialogTitle>
            <DialogDescription>
              Save your current roster with details for easy access later
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roster-name">Roster Name *</Label>
                <Input
                  id="roster-name"
                  placeholder="e.g., Summer League 2024"
                  value={rosterName}
                  onChange={(e) => setRosterName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="roster-sport">Sport</Label>
                <Input
                  id="roster-sport"
                  placeholder="e.g., Basketball"
                  value={rosterSport}
                  onChange={(e) => setRosterSport(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roster-description">Description</Label>
              <Textarea
                id="roster-description"
                placeholder="Add notes about this roster..."
                value={rosterDescription}
                onChange={(e) => setRosterDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roster-season">Season</Label>
                <Input
                  id="roster-season"
                  placeholder="e.g., Summer 2024"
                  value={rosterSeason}
                  onChange={(e) => setRosterSeason(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roster-tags">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="roster-tags"
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <Button type="button" size="sm" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {rosterTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rosterTags.map(tag => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 hover:text-red-500"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Roster Summary */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This roster contains {players.length} players
                {playerGroups.length > 0 && ` and ${playerGroups.length} groups`}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoster} disabled={isLoading || !rosterName.trim()}>
              {isLoading ? 'Saving...' : currentRosterId ? 'Update Roster' : 'Save Roster'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Roster Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Load Roster</DialogTitle>
            <DialogDescription>
              Select a roster to load
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search rosters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterSport} onValueChange={setFilterSport}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  {uniqueSports.map(sport => (
                    <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSeason} onValueChange={setFilterSeason}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Seasons</SelectItem>
                  {uniqueSeasons.map(season => (
                    <SelectItem key={season} value={season}>{season}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </Button>
            </div>

            {/* Options Bar */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Show archived rosters</span>
              </label>
              <span className="text-sm text-gray-500">
                {filteredRosters.length} roster{filteredRosters.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Rosters List/Grid */}
            <ScrollArea className="h-[400px]">
              {filteredRosters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm || filterSport !== 'all' || filterSeason !== 'all'
                    ? 'No rosters match your filters'
                    : 'No saved rosters yet'}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRosters.map((roster) => (
                    <Card key={roster.id} className={roster.isArchived ? 'opacity-60' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{roster.name}</CardTitle>
                            {roster.description && (
                              <CardDescription className="mt-1 text-xs">
                                {roster.description}
                              </CardDescription>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleLoadRoster(roster)}>
                                <Eye className="h-4 w-4 mr-2" /> Load
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelectedRoster(roster)}>
                                <Eye className="h-4 w-4 mr-2" /> Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicateRoster(roster.id!, roster.name)}>
                                <Copy className="h-4 w-4 mr-2" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportRoster(roster)}>
                                <Download className="h-4 w-4 mr-2" /> Export JSON
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleArchiveRoster(roster.id!, roster.isArchived!)}>
                                <Archive className="h-4 w-4 mr-2" /> 
                                {roster.isArchived ? 'Unarchive' : 'Archive'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteRoster(roster.id!)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Players:</span>
                            <span className="font-medium">{roster.metadata?.totalPlayers || 0}</span>
                          </div>
                          {roster.metadata?.avgSkillRating && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Avg Skill:</span>
                              <span className="font-medium">{roster.metadata.avgSkillRating}</span>
                            </div>
                          )}
                          {roster.sport && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Sport:</span>
                              <Badge variant="outline">{roster.sport}</Badge>
                            </div>
                          )}
                        </div>
                        {roster.tags && roster.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {roster.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-3 pb-3 text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(roster.updatedAt)}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRosters.map((roster) => (
                    <div
                      key={roster.id}
                      className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 ${
                        roster.isArchived ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{roster.name}</span>
                          {roster.isArchived && <Badge variant="secondary">Archived</Badge>}
                        </div>
                        <div className="text-sm text-gray-500 mt-1 space-x-4">
                          <span>{roster.metadata?.totalPlayers || 0} players</span>
                          {roster.sport && <span>{roster.sport}</span>}
                          {roster.season && <span>{roster.season}</span>}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(roster.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleLoadRoster(roster)}
                        >
                          Load
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedRoster(roster)}>
                              <Eye className="h-4 w-4 mr-2" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateRoster(roster.id!, roster.name)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportRoster(roster)}>
                              <Download className="h-4 w-4 mr-2" /> Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleArchiveRoster(roster.id!, roster.isArchived!)}>
                              <Archive className="h-4 w-4 mr-2" /> 
                              {roster.isArchived ? 'Unarchive' : 'Archive'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteRoster(roster.id!)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {selectedRoster && (
        <Dialog open={!!selectedRoster} onOpenChange={() => setSelectedRoster(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedRoster.name}</DialogTitle>
              {selectedRoster.description && (
                <DialogDescription>{selectedRoster.description}</DialogDescription>
              )}
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Players:</span>
                      <span className="font-medium">{selectedRoster.metadata?.totalPlayers || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Skill:</span>
                      <span className="font-medium">{selectedRoster.metadata?.avgSkillRating || 0}</span>
                    </div>
                    {selectedRoster.sport && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sport:</span>
                        <span className="font-medium">{selectedRoster.sport}</span>
                      </div>
                    )}
                    {selectedRoster.season && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Season:</span>
                        <span className="font-medium">{selectedRoster.season}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Gender Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Male:</span>
                      <span className="font-medium">{selectedRoster.metadata?.genderBreakdown.M || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Female:</span>
                      <span className="font-medium">{selectedRoster.metadata?.genderBreakdown.F || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Other:</span>
                      <span className="font-medium">{selectedRoster.metadata?.genderBreakdown.Other || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedRoster.tags && selectedRoster.tags.length > 0 && (
                <div>
                  <Label className="text-sm">Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedRoster.tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm">Players</Label>
                <ScrollArea className="h-48 mt-2 border rounded-lg">
                  <div className="p-3 space-y-1">
                    {selectedRoster.players.map((player, index) => (
                      <div key={player.id} className="flex items-center justify-between py-1 text-sm">
                        <span>
                          {index + 1}. {player.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{player.gender}</Badge>
                          <span className="text-gray-500">Skill: {player.skillRating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <div>Created: {formatDate(selectedRoster.createdAt)}</div>
                <div>Last Modified: {formatDate(selectedRoster.updatedAt)}</div>
                {selectedRoster.version && <div>Version: {selectedRoster.version}</div>}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRoster(null)}>
                Close
              </Button>
              <Button onClick={() => {
                handleLoadRoster(selectedRoster);
                setSelectedRoster(null);
              }}>
                Load This Roster
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}