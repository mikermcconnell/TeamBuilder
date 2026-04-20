import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// Workspace Context for managing projects
import { SavedWorkspace, AppState, LeagueConfig } from '@/types';
import { WorkspaceService } from '@/services/workspaceService';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import type { WorkspaceSaveResult } from '@/services/persistence/saveTypes';

interface WorkspaceContextType {
    currentWorkspaceId: string | null;
    workspaceName: string;
    workspaceDescription: string;
    savedWorkspaces: SavedWorkspace[];
    isLoading: boolean;
    isSaving: boolean;
    lastWorkspaceConflict: WorkspaceSaveResult | null;

    // Actions
    loadWorkspaces: () => Promise<void>;
    saveWorkspace: (
        data: Partial<AppState>,
        options?: {
            id?: string | null;
            name?: string;
            description?: string;
            silent?: boolean;
            refreshList?: boolean;
            expectedRevision?: number | null;
            force?: boolean;
        }
    ) => Promise<WorkspaceSaveResult | undefined>;
    loadWorkspace: (id: string) => Promise<SavedWorkspace | null>;
    getWorkspaceSnapshot: (id: string) => Promise<SavedWorkspace | null>;
    deleteWorkspace: (id: string) => Promise<void>;
    setCurrentWorkspaceInfo: (id: string | null, name: string, description: string) => void;
    createNewWorkspace: () => void;
    clearWorkspaceConflict: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

    // Workspace State
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
    const [currentWorkspaceRevision, setCurrentWorkspaceRevision] = useState<number | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceDescription, setWorkspaceDescription] = useState('');
    const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([]);
    const [lastWorkspaceConflict, setLastWorkspaceConflict] = useState<WorkspaceSaveResult | null>(null);

    // Loading States
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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

    // Reset state when user logs out
    useEffect(() => {
        if (!user) {
            setCurrentWorkspaceId(null);
            setCurrentWorkspaceRevision(null);
            setWorkspaceName('');
            setWorkspaceDescription('');
            setSavedWorkspaces([]);
            setLastWorkspaceConflict(null);
        } else {
            void loadWorkspaces();
        }
    }, [user, loadWorkspaces]);

    const saveWorkspace = useCallback(async (
        appState: Partial<AppState>,
        options?: {
            id?: string | null;
            name?: string;
            description?: string;
            silent?: boolean;
            refreshList?: boolean;
            expectedRevision?: number | null;
            force?: boolean;
        }
    ) => {
        if (!user) {
            if (!options?.silent) {
                toast.error('Please sign in to save projects');
            }
            return;
        }

        const effectiveId = options?.id ?? currentWorkspaceId;
        const trimmedName = (options?.name ?? workspaceName).trim();
        const trimmedDescription = (options?.description ?? workspaceDescription).trim();

        if (!trimmedName) {
            if (!options?.silent) {
                toast.error('Please enter a project name');
            }
            return;
        }

        setIsSaving(true);
        try {
            const payload: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt' | 'revision'> = {
                userId: user.uid,
                name: trimmedName,
                description: trimmedDescription,
                players: appState.players || [],
                playerGroups: appState.playerGroups || [],
                config: appState.config || ({} as LeagueConfig), // Should be safe if called correctly
                teams: appState.teams || [],
                unassignedPlayers: appState.unassignedPlayers || [],
                stats: appState.stats,
                execRatingHistory: appState.execRatingHistory || {},
                savedConfigs: appState.savedConfigs || [],
                teamIterations: appState.teamIterations || [],
                activeTeamIterationId: appState.activeTeamIterationId ?? null,
                leagueMemory: appState.leagueMemory || [],
                pendingWarnings: appState.pendingWarnings || [],
                version: 1,
            };

            const result = await WorkspaceService.saveWorkspace(payload, {
                id: effectiveId || undefined,
                expectedRevision: options?.expectedRevision ?? (effectiveId ? currentWorkspaceRevision : undefined),
                force: options?.force,
            });

            const id = result.id;

            if (result.type !== 'conflict' && result.type !== 'error') {
                setLastWorkspaceConflict(null);
                setCurrentWorkspaceId(id);
                setCurrentWorkspaceRevision(result.revision ?? currentWorkspaceRevision ?? 0);
                setWorkspaceName(trimmedName);
                setWorkspaceDescription(trimmedDescription);
            }

            // Update the list smoothly without full reload if possible, but fetching is safer
            if (options?.refreshList !== false && result.type !== 'error') {
                await loadWorkspaces();
            }

            if (result.type === 'conflict') {
                setLastWorkspaceConflict(result);
                if (!options?.silent) {
                    toast.warning('This project changed somewhere else. Reload it or save as a new project.', {
                        duration: 8000,
                    });
                }
                return result;
            }

            if (result.type === 'error') {
                if (!options?.silent) {
                    const errorMsg = result.error instanceof Error ? result.error.message : 'Please try again.';
                    toast.error(`Project save failed. ${errorMsg}`);
                }
                return result;
            }

            // Show appropriate feedback
            if (result.type === 'local') {
                console.error('Cloud save failed, error details:', result.cloud.error);
                if (!options?.silent) {
                    const errorCode = result.cloud.error?.code || 'unknown';
                    const errorMsg = result.cloud.error?.message || 'Check your network or any blocking extensions.';
                    toast.warning(`Cloud save blocked (${errorCode}). Saved locally.`, {
                        description: errorMsg.substring(0, 100),
                        duration: 8000,
                    });
                }
            } else if (!options?.silent) {
                toast.success('Project saved to cloud');
            }

            return result;
        } catch (error) {
            console.error('Failed to save project:', error);
            if (!options?.silent) {
                toast.error('Failed to save project');
            }
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [user, workspaceName, workspaceDescription, currentWorkspaceId, currentWorkspaceRevision, loadWorkspaces]);

    const loadWorkspace = useCallback(async (id: string) => {
        if (!user) return null;
        setIsLoading(true);
        try {
            const workspace = await WorkspaceService.getWorkspace(id, user.uid);
            if (workspace) {
                setCurrentWorkspaceId(workspace.id);
                setCurrentWorkspaceRevision(workspace.revision ?? 0);
                setWorkspaceName(workspace.name);
                setWorkspaceDescription(workspace.description || '');
                setLastWorkspaceConflict(null);
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

    const getWorkspaceSnapshot = useCallback(async (id: string) => {
        if (!user) return null;

        try {
            return await WorkspaceService.getWorkspace(id, user.uid);
        } catch (error) {
            console.error('Failed to fetch project snapshot:', error);
            toast.error('Failed to fetch latest project state');
            return null;
        }
    }, [user]);

    const deleteWorkspace = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await WorkspaceService.deleteWorkspace(id, user.uid);
            toast.success('Project deleted');

            if (currentWorkspaceId === id) {
                setCurrentWorkspaceId(null);
                setCurrentWorkspaceRevision(null);
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
        if (id !== undefined) {
            setCurrentWorkspaceId(id);
            if (id === null || id !== currentWorkspaceId) {
                setCurrentWorkspaceRevision(null);
            }
        }
        setWorkspaceName(name);
        setWorkspaceDescription(description);
    }, [currentWorkspaceId]);

    const createNewWorkspace = useCallback(() => {
        setCurrentWorkspaceId(null);
        setCurrentWorkspaceRevision(null);
        setWorkspaceName('Project ' + new Date().toLocaleDateString());
        setWorkspaceDescription('');
        setLastWorkspaceConflict(null);
    }, []);

    const clearWorkspaceConflict = useCallback(() => {
        setLastWorkspaceConflict(null);
    }, []);

    return (
        <WorkspaceContext.Provider value={{
            currentWorkspaceId,
            workspaceName,
            workspaceDescription,
            savedWorkspaces,
            isLoading,
            isSaving,
            lastWorkspaceConflict,
            loadWorkspaces,
            saveWorkspace,
            loadWorkspace,
            getWorkspaceSnapshot,
            deleteWorkspace,
            setCurrentWorkspaceInfo,
            createNewWorkspace,
            clearWorkspaceConflict,
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
