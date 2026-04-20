import React, { useState, useEffect } from 'react';
import { SavedRoster, RosterStorageService } from '@/services/rosterStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Trash2,
  Download,
  Edit,
  FileText,
  Users,
  Calendar,
  Loader2,
  CloudOff,
  CloudUpload
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { auth } from '@/config/firebase';

interface SavedRostersListProps {
  onLoadRoster: (csvContent: string, rosterName: string) => void;
  currentCSVContent?: string;
  currentPlayerCount?: number;
}

export function SavedRostersList({
  onLoadRoster,
  currentCSVContent,
  currentPlayerCount
}: SavedRostersListProps) {
  const [savedRosters, setSavedRosters] = useState<SavedRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoster, setSelectedRoster] = useState<SavedRoster | null>(null);
  const [deleteConfirmRoster, setDeleteConfirmRoster] = useState<SavedRoster | null>(null);
  const [editRoster, setEditRoster] = useState<SavedRoster | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Save current roster dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (user) {
        loadSavedRosters();
      } else {
        setSavedRosters([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const loadSavedRosters = async () => {
    setLoading(true);
    try {
      const rosters = await RosterStorageService.getSavedRosters();
      setSavedRosters(rosters);
    } catch (error) {
      toast.error('Failed to load saved rosters');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadRoster = async (roster: SavedRoster) => {
    try {
      const csvContent = await RosterStorageService.loadRosterContent(roster.csvUrl);
      onLoadRoster(csvContent, roster.name);
      toast.success(`Loaded roster: ${roster.name}`);
      setSelectedRoster(null);
    } catch (error) {
      toast.error('Failed to load roster');
      console.error(error);
    }
  };

  const handleDeleteRoster = async (roster: SavedRoster) => {
    try {
      await RosterStorageService.deleteRoster(roster.id);
      setSavedRosters(prev => prev.filter(r => r.id !== roster.id));
      toast.success(`Deleted roster: ${roster.name}`);
      setDeleteConfirmRoster(null);
    } catch (error) {
      toast.error('Failed to delete roster');
      console.error(error);
    }
  };

  const handleUpdateRoster = async () => {
    if (!editRoster) return;

    try {
      await RosterStorageService.updateRoster(editRoster.id, {
        name: editName,
        description: editDescription
      });

      setSavedRosters(prev => prev.map(r =>
        r.id === editRoster.id
          ? { ...r, name: editName, description: editDescription }
          : r
      ));

      toast.success('Roster updated successfully');
      setEditRoster(null);
    } catch (error) {
      toast.error('Failed to update roster');
      console.error(error);
    }
  };

  const handleSaveCurrentRoster = async () => {
    if (!currentCSVContent || !saveName) {
      toast.error('Please provide a name for the roster');
      return;
    }

    setSaving(true);
    try {
      // Extract headers from CSV
      const lines = currentCSVContent.split('\n');
      const headers = lines[0]?.split(',').map(h => h.trim()) || [];

      const savedRoster = await RosterStorageService.saveRoster(
        currentCSVContent,
        saveName,
        saveDescription,
        headers
      );

      setSavedRosters(prev => [savedRoster, ...prev]);
      toast.success(`Saved roster: ${saveName}`);
      setShowSaveDialog(false);
      setSaveName('');
      setSaveDescription('');
    } catch (error) {
      toast.error('Failed to save roster');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudOff className="h-5 w-5" />
            Sign In Required
          </CardTitle>
          <CardDescription>
            Please sign in to save and load rosters from the cloud
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Save Current Roster Button */}
      {currentCSVContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudUpload className="h-5 w-5" />
              Save Current Roster
            </CardTitle>
            <CardDescription>
              Save your current roster to the cloud for future use
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowSaveDialog(true)} className="w-full">
              <CloudUpload className="h-4 w-4 mr-2" />
              Save Current Roster ({currentPlayerCount || 0} players)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Saved Rosters List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Saved Rosters
          </CardTitle>
          <CardDescription>
            Load previously saved rosters from the cloud
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : savedRosters.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No saved rosters found. Upload a CSV and save it for future use.
            </div>
          ) : (
            <div className="space-y-3">
              {savedRosters.map((roster) => (
                <div
                  key={roster.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{roster.name}</h4>
                      {roster.description && (
                        <p className="text-sm text-gray-600 mt-1">{roster.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {roster.playerCount} players
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(roster.fileSize)}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(roster.createdAt.toDate(), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadRoster(roster)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditRoster(roster);
                          setEditName(roster.name);
                          setEditDescription(roster.description || '');
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteConfirmRoster(roster)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Roster to Cloud</DialogTitle>
            <DialogDescription>
              Give your roster a name and optional description for easy identification later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roster-name">Roster Name *</Label>
              <Input
                id="roster-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g., Spring 2024 League"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roster-description">Description (Optional)</Label>
              <Textarea
                id="roster-description"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="e.g., Recreation league with 40 players, mixed skill levels"
                rows={3}
              />
            </div>
            <div className="text-sm text-gray-600">
              This will save {currentPlayerCount || 0} players to the cloud
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCurrentRoster} disabled={!saveName || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CloudUpload className="h-4 w-4 mr-2" />
                  Save Roster
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRoster} onOpenChange={() => setEditRoster(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Roster Details</DialogTitle>
            <DialogDescription>
              Update the name and description of your saved roster
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Roster Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoster(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRoster}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmRoster} onOpenChange={() => setDeleteConfirmRoster(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Roster</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmRoster?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmRoster(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmRoster && handleDeleteRoster(deleteConfirmRoster)}
            >
              Delete Roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}