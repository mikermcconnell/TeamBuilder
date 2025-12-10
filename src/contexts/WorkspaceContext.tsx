import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Workspace Context for managing projects
import { SavedWorkspace, AppState, LeagueConfig } from '@/types';
import { WorkspaceService } from '@/services/workspaceService';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface WorkspaceContextType {
    currentWorkspaceId: string | null;
    workspaceName: string;
    workspaceDescription: string;
    savedWorkspaces: SavedWorkspace[];
    isLoading: boolean;
    isSaving: boolean;

    // Actions
    loadWorkspaces: () => Promise<void>;
    saveWorkspace: (data: Partial<AppState>) => Promise<string | undefined>;
    loadWorkspace: (id: string) => Promise<SavedWorkspace | null>;
    deleteWorkspace: (id: string) => Promise<void>;
    setCurrentWorkspaceInfo: (id: string | null, name: string, description: string) => void;
    createNewWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    // Workspace State
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceDescription, setWorkspaceDescription] = useState('');
    const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([]);

    // Loading States
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Reset state when user logs out
    useEffect(() => {
        if (!user) {
            setCurrentWorkspaceId(null);
            setWorkspaceName('');
            setWorkspaceDescription('');
            setSavedWorkspaces([]);
        } else {
            loadWorkspaces();
        }
    }, [user]);

    const loadWorkspaces = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const workspaces = await WorkspaceService.getUserWorkspaces(user.uid);
            setSavedWorkspaces(workspaces);
        } catch (error) {
            console.error('Failed to load saved workspaces:', error);
            toast.error('Failed to load saved projects');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const saveWorkspace = useCallback(async (appState: Partial<AppState>) => {
        if (!user) {
            toast.error('Please sign in to save projects');
            return;
        }

        const trimmedName = workspaceName.trim();
        if (!trimmedName) {
            toast.error('Please enter a project name');
            return;
        }

        setIsSaving(true);
        try {
            const payload: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'> = {
                userId: user.uid,
                name: trimmedName,
                description: workspaceDescription.trim(),
                players: appState.players || [],
                playerGroups: appState.playerGroups || [],
                config: appState.config || ({} as LeagueConfig), // Should be safe if called correctly
                teams: appState.teams || [],
                unassignedPlayers: appState.unassignedPlayers || [],
                stats: appState.stats,
                version: 1,
            };

            const id = await WorkspaceService.saveWorkspace(payload, currentWorkspaceId || undefined);
            setCurrentWorkspaceId(id);

            // Update the list smoothly without full reload if possible, but fetching is safer
            loadWorkspaces();

            return id;
        } catch (error) {
            console.error('Failed to save project:', error);
            toast.error('Failed to save project');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [user, workspaceName, workspaceDescription, currentWorkspaceId, loadWorkspaces]);

    const loadWorkspace = useCallback(async (id: string) => {
        if (!user) return null;
        setIsLoading(true);
        try {
            const workspace = await WorkspaceService.getWorkspace(id);
            if (workspace) {
                setCurrentWorkspaceId(workspace.id);
                setWorkspaceName(workspace.name);
                setWorkspaceDescription(workspace.description || '');
                return workspace;
            }
            return null;
        } catch (error) {
            console.error('Failed to load project:', error);
            toast.error('Failed to load project');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const deleteWorkspace = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await WorkspaceService.deleteWorkspace(id);
            toast.success('Project deleted');

            if (currentWorkspaceId === id) {
                setCurrentWorkspaceId(null);
                setWorkspaceName('');
                setWorkspaceDescription('');
            }

            loadWorkspaces();
        } catch (error) {
            console.error('Failed to delete project:', error);
            toast.error('Failed to delete project');
        }
    }, [user, currentWorkspaceId, loadWorkspaces]);

    const setCurrentWorkspaceInfo = useCallback((id: string | null, name: string, description: string) => {
        if (id !== undefined) setCurrentWorkspaceId(id);
        setWorkspaceName(name);
        setWorkspaceDescription(description);
    }, []);

    const createNewWorkspace = useCallback(() => {
        setCurrentWorkspaceId(null);
        setWorkspaceName('Project ' + new Date().toLocaleDateString());
        setWorkspaceDescription('');
    }, []);

    return (
        <WorkspaceContext.Provider value={{
            currentWorkspaceId,
            workspaceName,
            workspaceDescription,
            savedWorkspaces,
            isLoading,
            isSaving,
            loadWorkspaces,
            saveWorkspace,
            loadWorkspace,
            deleteWorkspace,
            setCurrentWorkspaceInfo,
            createNewWorkspace
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
