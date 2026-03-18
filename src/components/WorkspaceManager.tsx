import React, { useState, useEffect } from 'react';
import { Player, Team, LeagueConfig, PlayerGroup, SavedWorkspace, TeamGenerationStats } from '@/types';
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
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

interface WorkspaceManagerProps {
    players: Player[];
    playerGroups: PlayerGroup[];
    teams: Team[];
    unassignedPlayers: Player[];
    config: LeagueConfig;
    stats?: TeamGenerationStats;
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
    currentWorkspaceId: propWorkspaceId,
    mode = 'default'
}: WorkspaceManagerProps) {
    const { user } = useAuth();
    const {
        savedWorkspaces,
        saveWorkspace,
        deleteWorkspace,
        workspaceName: contextWorkspaceName,
        workspaceDescription: contextWorkspaceDescription,
        currentWorkspaceId: contextWorkspaceId,
        setCurrentWorkspaceInfo,
        isSaving
    } = useWorkspace();

    // Prioritize context ID but fallback to prop if needed (though we rely on context now)
    const currentId = contextWorkspaceId || propWorkspaceId;

    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);

    // Local state for the save dialog form
    const [saveName, setSaveName] = useState('');
    const [saveDescription, setSaveDescription] = useState('');

    // Check if we are editing an existing workspace or creating new
    // When dialog opens, we want to sync with context
    useEffect(() => {
        if (isSaveDialogOpen) {
            setSaveName(contextWorkspaceName || '');
            setSaveDescription(contextWorkspaceDescription || '');
        }
    }, [isSaveDialogOpen, contextWorkspaceName, contextWorkspaceDescription]);

    const handleSaveSubmit = async () => {
        if (!user) {
            toast.error('Please sign in to save projects');
            return;
        }

        if (!saveName.trim()) {
            toast.error('Please enter a name for the project');
            return;
        }

        try {
            await saveWorkspace(
                {
                    players,
                    playerGroups,
                    teams,
                    unassignedPlayers,
                    config,
                    stats
                },
                {
                    id: currentId || null,
                    name: saveName.trim(),
                    description: saveDescription.trim()
                }
            );
            setCurrentWorkspaceInfo(currentId || null, saveName.trim(), saveDescription.trim());
            setIsSaveDialogOpen(false);
        } catch (error: any) {
            console.error('Failed to save project:', error);
            toast.error(`Save failed: ${error?.message || 'Unknown error'}`);
        }
    };

    const handleLoadClick = (id: string) => {
        onLoadWorkspace(id);
        setIsLoadDialogOpen(false);
    };

    const handleDeleteClick = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this project?')) return;

        await deleteWorkspace(id);
    };

    const saveDialog = (
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="gap-2">
                    <Save className="h-4 w-4" />
                    {currentId ? 'Save Project' : 'Save New Project'}
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
                    <Button onClick={handleSaveSubmit} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Project'}
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
                                    className={`cursor-pointer transition-colors ${currentId === ws.id
                                        ? 'ring-2 ring-primary'
                                        : 'hover:bg-accent/50'
                                        }`}
                                    onClick={() => handleLoadClick(ws.id)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    {currentId === ws.id && (
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
                                                    onClick={(e) => handleDeleteClick(ws.id, e)}
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
                    <Button variant="outline" onClick={() => setIsLoadDialogOpen(false)}>
                        Cancel
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
                {/* Autosave Indicator */}
                <div className="w-16 flex justify-end">
                    {isSaving && (
                        <span className="text-xs text-slate-400 italic animate-pulse">Saving...</span>
                    )}
                </div>
            </div>
        );
    }

    // Default mode
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Saved Projects</h3>
                <div className="flex gap-6">
                    {saveDialog}
                    {loadDialog}
                </div>
            </div>

            {!user && (
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
