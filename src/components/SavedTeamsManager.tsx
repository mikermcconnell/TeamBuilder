import React, { useState, useEffect } from 'react';
import {
  saveTeams,
  getUserTeams,
  deleteTeams,
  updateTeams,
  TeamsData
} from '@/services/teamsService';
import { auth } from '@/config/firebase';
import { Team, Player, LeagueConfig } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  Clock,
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SavedTeamsManagerProps {
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  rosterId?: string;
  onLoadTeams: (teams: Team[], unassignedPlayers: Player[], config: LeagueConfig) => void;
}

export function SavedTeamsManager({
  teams,
  unassignedPlayers,
  config,
  rosterId,
  onLoadTeams
}: SavedTeamsManagerProps) {
  const [savedTeamsList, setSavedTeamsList] = useState<TeamsData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [selectedTeamsId, setSelectedTeamsId] = useState<string | null>(null);

  // Load saved teams when component mounts or user changes
  useEffect(() => {
    loadSavedTeams();
  }, [auth.currentUser]);

  const loadSavedTeams = async () => {
    if (!auth.currentUser) return;

    setIsLoading(true);
    try {
      const teams = await getUserTeams(auth.currentUser.uid, rosterId);
      setSavedTeamsList(teams);
    } catch (error) {
      console.error('Failed to load saved teams:', error);
      toast.error('Failed to load saved teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTeams = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to save teams');
      return;
    }

    if (!saveName.trim()) {
      toast.error('Please enter a name for the saved teams');
      return;
    }

    if (teams.length === 0) {
      toast.error('No teams to save');
      return;
    }

    setIsLoading(true);
    try {
      const teamsData: Omit<TeamsData, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: auth.currentUser.uid,
        rosterId: rosterId,
        name: saveName.trim(),
        description: saveDescription.trim(),
        teams,
        unassignedPlayers,
        config,
        generationMethod: 'balanced'
      };

      const id = await saveTeams(teamsData);
      toast.success(`Teams saved as "${saveName}"`);

      // Reload the list
      await loadSavedTeams();

      // Reset dialog
      setIsSaveDialogOpen(false);
      setSaveName('');
      setSaveDescription('');
    } catch (error) {
      console.error('Failed to save teams:', error);
      toast.error('Failed to save teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTeams = async () => {
    if (!selectedTeamsId) {
      toast.error('Please select a saved teams configuration');
      return;
    }

    const selectedTeams = savedTeamsList.find(t => t.id === selectedTeamsId);
    if (!selectedTeams) {
      toast.error('Selected teams not found');
      return;
    }

    onLoadTeams(selectedTeams.teams, selectedTeams.unassignedPlayers, selectedTeams.config);
    toast.success(`Loaded teams: ${selectedTeams.name}`);
    setIsLoadDialogOpen(false);
    setSelectedTeamsId(null);
  };

  const handleDeleteTeams = async (teamsId: string) => {
    if (!confirm('Are you sure you want to delete this saved team configuration?')) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteTeams(teamsId);
      toast.success('Teams deleted successfully');
      await loadSavedTeams();
    } catch (error) {
      console.error('Failed to delete teams:', error);
      toast.error('Failed to delete teams');
    } finally {
      setIsLoading(false);
    }
  };

  const exportTeamsToJSON = (teamsData: TeamsData) => {
    const exportData = {
      name: teamsData.name,
      description: teamsData.description,
      teams: teamsData.teams,
      unassignedPlayers: teamsData.unassignedPlayers,
      config: teamsData.config,
      generationMethod: teamsData.generationMethod,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teams-${teamsData.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Teams exported successfully');
  };

  const getTotalPlayers = (teamsData: TeamsData) => {
    const assignedCount = teamsData.teams.reduce((sum, team) => sum + team.players.length, 0);
    const unassignedCount = teamsData.unassignedPlayers.length;
    return assignedCount + unassignedCount;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Saved Teams</h3>
        <div className="flex gap-2">
          <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="default"
                disabled={teams.length === 0}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save Current Teams
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Teams Configuration</DialogTitle>
                <DialogDescription>
                  Save your current team configuration to load it again later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="save-name">Name *</Label>
                  <Input
                    id="save-name"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g., Spring Season Teams, Tournament A"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="save-description">Description (optional)</Label>
                  <Textarea
                    id="save-description"
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Add notes about this team configuration..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>This will save:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>{teams.length} teams with {teams.reduce((sum, t) => sum + t.players.length, 0)} assigned players</li>
                    <li>{unassignedPlayers.length} unassigned players</li>
                    <li>Team configuration settings</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTeams} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Teams'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={savedTeamsList.length === 0}
                className="gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Load Teams
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Load Saved Teams</DialogTitle>
                <DialogDescription>
                  Select a saved team configuration to load.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                {savedTeamsList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No saved teams found</p>
                    <p className="text-sm mt-1">Save your current teams to load them later</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {savedTeamsList.map((teamsData) => (
                      <Card
                        key={teamsData.id}
                        className={`cursor-pointer transition-colors ${
                          selectedTeamsId === teamsData.id
                            ? 'ring-2 ring-primary'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => setSelectedTeamsId(teamsData.id!)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-base flex items-center gap-2">
                                {selectedTeamsId === teamsData.id && (
                                  <CheckCircle className="h-4 w-4 text-primary" />
                                )}
                                {teamsData.name}
                              </CardTitle>
                              {teamsData.description && (
                                <CardDescription className="text-sm">
                                  {teamsData.description}
                                </CardDescription>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportTeamsToJSON(teamsData);
                                }}
                                title="Export to JSON"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTeams(teamsData.id!);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span>{teamsData.teams.length} teams</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span>{getTotalPlayers(teamsData)} players</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{teamsData.updatedAt ? format(teamsData.updatedAt, 'MMM d, h:mm a') : 'N/A'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsLoadDialogOpen(false);
                  setSelectedTeamsId(null);
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleLoadTeams}
                  disabled={!selectedTeamsId || isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load Teams'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!auth.currentUser && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900">Sign in to save teams</p>
                <p className="text-yellow-800 mt-1">
                  Sign in to save and load your team configurations across sessions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}