import React, { useState, useEffect } from 'react';
import {
    WorkspaceService
} from '@/services/workspaceService';
import { auth } from '@/config/firebase';
import { Player, Team, LeagueConfig, PlayerGroup, SavedWorkspace, StatsData } from '@/types';
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
    Save,
    FolderOpen,
    Trash2,
    Users,
    CheckCircle,
    AlertCircle,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface WorkspaceManagerProps {
    players: Player[];
    playerGroups: PlayerGroup[];
    teams: Team[];
    unassignedPlayers: Player[];
    config: LeagueConfig;
    stats?: StatsData;
    onLoadWorkspace: (id: string) => void;
    currentWorkspaceId?: string | null;
    mode?: 'default' | 'toolbar';
}

export function WorkspaceManager({
    players,
    playerGroups,
    teams,
    unassignedPlayers,
    config,
    stats,
    onLoadWorkspace,
    currentWorkspaceId,
    mode = 'default'
}: WorkspaceManagerProps) {
    const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveDescription, setSaveDescription] = useState('');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

    // Load workspaces when component mounts or user changes
    useEffect(() => {
        loadSavedWorkspaces();
    }, [auth.currentUser]);

    const loadSavedWorkspaces = async () => {
        if (!auth.currentUser) return;

        setIsLoading(true);
        try {
            const workspaces = await WorkspaceService.getUserWorkspaces(auth.currentUser.uid);
            setSavedWorkspaces(workspaces);
        } catch (error) {
            console.error('Failed to load saved projects:', error);
            toast.error('Failed to load saved projects');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveWorkspace = async () => {
        if (!auth.currentUser) {
            toast.error('Please sign in to save projects');
            return;
        }

        if (!saveName.trim()) {
            toast.error('Please enter a name for the project');
            return;
        }

        setIsLoading(true);
        try {
            const workspaceData: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'> = {
                userId: auth.currentUser.uid,
                name: saveName.trim(),
                description: saveDescription.trim(),
                players,
                playerGroups,
                teams,
                unassignedPlayers,
                config,
                stats,
                version: 1
            };

            // Pass currentWorkspaceId only if we are overwriting, but here we are treating "Save As" effectively in the dialog?
            // Or should we allow overwriting if the name matches or if we passed an ID?
            // Logic from App.tsx implies a "Save Project" (overwrite) vs "Save As" workflow. 
            // This generic manager seems to act as "Save As" / "New Save" unless we explicitly handle overwrite logic.
            // For simplicity in this toolbar version, let's treat it as "Save New" or "Update Current if ID exists AND we want to?"
            // Ideally, the Save button should probably just save to current if valid, or prompt for name if new.
            // But looking at SavedTeamsManager, it always prompts for name. Let's follow that pattern for now: Always prompt for name (Save As).
            // Actually, if we want to mimic the "Save Project" functionality of App.tsx which saves to current ID, we need to know if user intends to overwrite.

            // Let's stick to "Save As" behavior for this explicit dialog to be safe, creating a new snapshot. 
            // OR, we can check if we have a currentWorkspaceId and the name matches?
            // Let's just create a new entry for now to avoid accidental data loss, or we can improve this later. Use undefined for ID to force new.

            await WorkspaceService.saveWorkspace(workspaceData);

            toast.success(`Project saved as "${saveName}"`);

            // Reload the list
            await loadSavedWorkspaces();

            // Reset dialog
            setIsSaveDialogOpen(false);
            setSaveName('');
            setSaveDescription('');
        } catch (error) {
            console.error('Failed to save project:', error);
            toast.error('Failed to save project');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadWorkspace = async () => {
        if (!selectedWorkspaceId) {
            toast.error('Please select a project to load');
            return;
        }

        onLoadWorkspace(selectedWorkspaceId);

        // We don't need to manually find the workspace content, the App will load it via ID.
        // But we might want to close the dialog.
        setIsLoadDialogOpen(false);
        setSelectedWorkspaceId(null);
    };

    const handleDeleteWorkspace = async (workspaceId: string) => {
        if (!confirm('Are you sure you want to delete this project?')) {
            return;
        }

        setIsLoading(true);
        try {
            await WorkspaceService.deleteWorkspace(workspaceId);
            toast.success('Project deleted successfully');
            await loadSavedWorkspaces();
        } catch (error) {
            console.error('Failed to delete project:', error);
            toast.error('Failed to delete project');
        } finally {
            setIsLoading(false);
        }
    };

    const saveDialog = (
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="default"
                    className="gap-2"
                >
                    <Save className="h-4 w-4" />
                    Save Project
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Save Project</DialogTitle>
                    <DialogDescription>
                        Save your entire workspace (players, teams, configuration) to resume later.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="save-name">Name *</Label>
                        <Input
                            id="save-name"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            placeholder="e.g., Summer League 2024"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="save-description">Description (optional)</Label>
                        <Textarea
                            id="save-description"
                            value={saveDescription}
                            onChange={(e) => setSaveDescription(e.target.value)}
                            placeholder="Add notes about this project..."
                            className="mt-1"
                            rows={3}
                        />
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <p>This will save:</p>
                        <ul className="list-disc list-inside mt-1">
                            <li>{players.length} players total</li>
                            <li>{teams.length} teams generated</li>
                            <li>All player groups and settings</li>
                        </ul>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveWorkspace} disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save Project'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    const loadDialog = (
        <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    disabled={savedWorkspaces.length === 0}
                    className="gap-2"
                >
                    <FolderOpen className="h-4 w-4" />
                    Load Project
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Load Project</DialogTitle>
                    <DialogDescription>
                        Select a saved project to load.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {savedWorkspaces.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                            <p>No saved projects found</p>
                            <p className="text-sm mt-1">Save your current workspace to load it later</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {savedWorkspaces.map((ws) => (
                                <Card
                                    key={ws.id}
                                    className={`cursor-pointer transition-colors ${selectedWorkspaceId === ws.id
                                        ? 'ring-2 ring-primary'
                                        : 'hover:bg-accent/50'
                                        }`}
                                    onClick={() => setSelectedWorkspaceId(ws.id)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    {selectedWorkspaceId === ws.id && (
                                                        <CheckCircle className="h-4 w-4 text-primary" />
                                                    )}
                                                    {ws.name}
                                                </CardTitle>
                                                {ws.description && (
                                                    <CardDescription className="text-sm">
                                                        {ws.description}
                                                    </CardDescription>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteWorkspace(ws.id);
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
                                                <span>{ws.players?.length || 0} players</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Users className="h-3.5 w-3.5" />
                                                <span>{ws.teams?.length || 0} teams</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5" />
                                                <span>{ws.updatedAt ? format(new Date(ws.updatedAt), 'MMM d, h:mm a') : 'N/A'}</span>
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
                        setSelectedWorkspaceId(null);
                    }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleLoadWorkspace}
                        disabled={!selectedWorkspaceId || isLoading}
                    >
                        {isLoading ? 'Loading...' : 'Load Project'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    if (mode === 'toolbar') {
        return (
            <div className="flex items-center gap-3 px-1">
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Projects</span>
                <div className="flex items-center gap-2">
                    {saveDialog}
                    {loadDialog}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Saved Projects</h3>
                <div className="flex gap-6">
                    {saveDialog}
                    {loadDialog}
                </div>
            </div>

            {!auth.currentUser && (
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-yellow-900">Sign in to save projects</p>
                                <p className="text-yellow-800 mt-1">
                                    Sign in to save and load your entire workspace configuration.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
