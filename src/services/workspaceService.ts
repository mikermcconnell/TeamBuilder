import { db } from '@/config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    deleteDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { SavedWorkspace } from '@/types';
import { cleanUndefinedDeep } from './persistence/cleanup';
import { buildLocalStorageKey, readFirstLocalStorageValue } from './persistence/localKeys';
import type { SaveTargetResult, WorkspaceSaveResult } from './persistence/saveTypes';
import { sanitizeWorkspaceForLocalCache } from './persistence/localCacheSanitizer';

export class WorkspaceService {
    private static readonly COLLECTION = 'workspaces';
    private static readonly LEGACY_LOCAL_KEY = 'local_saved_workspaces';
    private static readonly LOCAL_KEY_PREFIX = 'local_saved_workspaces';

    private static getLocalKey(userId: string): string {
        return buildLocalStorageKey(this.LOCAL_KEY_PREFIX, userId);
    }

    private static readLocalWorkspaces(userId: string): SavedWorkspace[] {
        try {
            const existingStr = readFirstLocalStorageValue([
                this.getLocalKey(userId),
                this.LEGACY_LOCAL_KEY,
            ]);
            const parsed = existingStr ? JSON.parse(existingStr) as SavedWorkspace[] : [];
            return parsed
                .filter(workspace => workspace.userId === userId)
                .map(workspace => this.normalizeWorkspace(workspace));
        } catch (error) {
            console.warn('Failed to read local workspaces:', error);
            return [];
        }
    }

    private static writeLocalWorkspaces(userId: string, workspaces: SavedWorkspace[]): void {
        localStorage.setItem(
            this.getLocalKey(userId),
            JSON.stringify(workspaces.map(workspace => sanitizeWorkspaceForLocalCache(workspace)))
        );
    }

    private static getWorkspaceTimestamp(workspace?: SavedWorkspace | null): number {
        const timestampSource = workspace?.updatedAtServer || workspace?.updatedAt;
        if (!timestampSource) {
            return 0;
        }

        const timestamp = new Date(timestampSource).getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    private static toIsoString(value: unknown): string | undefined {
        if (value instanceof Timestamp) {
            return value.toDate().toISOString();
        }

        if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
            return (value as { toDate: () => Date }).toDate().toISOString();
        }

        return typeof value === 'string' && value ? value : undefined;
    }

    private static preferNewerWorkspace(first?: SavedWorkspace | null, second?: SavedWorkspace | null): SavedWorkspace | null {
        if (!first) return second ?? null;
        if (!second) return first;
        return this.getWorkspaceTimestamp(second) > this.getWorkspaceTimestamp(first) ? second : first;
    }

    private static normalizeWorkspace(workspace: SavedWorkspace): SavedWorkspace {
        return {
            ...workspace,
            execRatingHistory: workspace.execRatingHistory || {},
            savedConfigs: workspace.savedConfigs || [],
            teamIterations: workspace.teamIterations || [],
            activeTeamIterationId: workspace.activeTeamIterationId ?? null,
            leagueMemory: workspace.leagueMemory || [],
            pendingWarnings: workspace.pendingWarnings || [],
            revision: workspace.revision ?? 0,
            createdAtServer: this.toIsoString(workspace.createdAtServer),
            updatedAtServer: this.toIsoString(workspace.updatedAtServer),
        };
    }

    private static upsertLocalWorkspace(workspace: SavedWorkspace): void {
        const existing = this.readLocalWorkspaces(workspace.userId);
        const existingIndex = existing.findIndex(w => w.id === workspace.id);

        if (existingIndex >= 0) {
            existing[existingIndex] = workspace;
        } else {
            existing.push(workspace);
        }

        this.writeLocalWorkspaces(workspace.userId, existing);
    }

    /**
     * Save a workspace to Firestore. Creates new or updates existing.
     */
    static async saveWorkspace(
        workspace: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt' | 'revision'>,
        options?: {
            id?: string;
            expectedRevision?: number | null;
            force?: boolean;
        }
    ): Promise<WorkspaceSaveResult> {
        const workspaceId = options?.id || doc(collection(db, this.COLLECTION)).id;
        const now = new Date().toISOString();
        const existingLocalWorkspace = this.readLocalWorkspaces(workspace.userId).find(w => w.id === workspaceId) || null;

        let existingCloudWorkspace: SavedWorkspace | null = null;
        try {
            const existingCloudDoc = await getDoc(doc(db, this.COLLECTION, workspaceId));
            if (existingCloudDoc.exists()) {
                existingCloudWorkspace = this.normalizeWorkspace(existingCloudDoc.data() as SavedWorkspace);
            }
        } catch (error) {
            console.warn('Failed to fetch current cloud workspace before save:', error);
        }

        const latestExistingWorkspace = this.preferNewerWorkspace(existingCloudWorkspace, existingLocalWorkspace);
        const actualRevision = latestExistingWorkspace?.revision ?? 0;
        const expectedRevision = options?.expectedRevision ?? undefined;

        if (!options?.force && expectedRevision !== undefined && actualRevision > expectedRevision) {
            return {
                id: workspaceId,
                type: 'conflict',
                revision: actualRevision,
                conflict: {
                    expectedRevision,
                    actualRevision,
                },
                local: {
                    attempted: false,
                    saved: false,
                },
                cloud: {
                    attempted: false,
                    saved: false,
                },
                error: new Error('Workspace save conflict detected'),
            };
        }

        const rawPayload = {
            ...workspace,
            id: workspaceId,
            updatedAt: now,
            createdAt: latestExistingWorkspace?.createdAt || now,
            createdAtServer: latestExistingWorkspace?.createdAtServer,
            updatedAtServer: latestExistingWorkspace?.updatedAtServer,
            revision: actualRevision + 1,
        };

        const payload = this.normalizeWorkspace(cleanUndefinedDeep(rawPayload) as SavedWorkspace);

        const localResult = this.trySaveLocalWorkspace(payload);
        const cloudResult = await this.trySaveCloudWorkspace(payload);

        const normalizedCloudWorkspace = cloudResult.workspace
            ? this.normalizeWorkspace(cloudResult.workspace)
            : null;

        if (normalizedCloudWorkspace) {
            const syncedLocalResult = this.trySaveLocalWorkspace(normalizedCloudWorkspace);
            if (!localResult.saved && syncedLocalResult.saved) {
                localResult.saved = true;
                localResult.error = undefined;
            } else if (syncedLocalResult.error) {
                localResult.error = localResult.error ?? syncedLocalResult.error;
            }
        }

        if (cloudResult.saved) {
            return {
                id: workspaceId,
                revision: normalizedCloudWorkspace?.revision ?? payload.revision,
                type: 'cloud',
                local: localResult,
                cloud: cloudResult,
                ...(localResult.error ? { error: localResult.error } : {}),
            };
        }

        if (localResult.saved) {
            return {
                id: workspaceId,
                revision: payload.revision,
                type: 'local',
                local: localResult,
                cloud: cloudResult,
                error: cloudResult.error,
            };
        }

        return {
            id: workspaceId,
            revision: actualRevision,
            type: 'error',
            local: localResult,
            cloud: cloudResult,
            error: cloudResult.error ?? localResult.error,
        };
    }

    private static trySaveLocalWorkspace(workspace: SavedWorkspace): SaveTargetResult {
        try {
            this.upsertLocalWorkspace(workspace);
            return {
                attempted: true,
                saved: true,
            };
        } catch (storageError) {
            return {
                attempted: true,
                saved: false,
                error: storageError instanceof DOMException &&
                    (storageError.name === 'QuotaExceededError' || storageError.code === 22)
                    ? new Error('Local storage is full. Please delete old projects or free up browser storage.')
                    : storageError,
            };
        }
    }

    private static async trySaveCloudWorkspace(workspace: SavedWorkspace): Promise<SaveTargetResult & { workspace?: SavedWorkspace }> {
        try {
            const workspaceRef = doc(db, this.COLLECTION, workspace.id);
            const cloudPayload = cleanUndefinedDeep({
                ...workspace,
                createdAtServer: workspace.createdAtServer ?? serverTimestamp(),
                updatedAtServer: serverTimestamp(),
            }) as SavedWorkspace;

            await setDoc(workspaceRef, cloudPayload, { merge: true });
            const savedDoc = await getDoc(workspaceRef);
            return {
                attempted: true,
                saved: true,
                workspace: savedDoc.exists()
                    ? this.normalizeWorkspace(savedDoc.data() as SavedWorkspace)
                    : workspace,
            };
        } catch (error: unknown) {
            console.error('Error saving workspace to cloud:', {
                error,
                code: error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined,
                message: error instanceof Error ? error.message : undefined,
                userId: workspace.userId,
                workspaceId: workspace.id
            });

            return {
                attempted: true,
                saved: false,
                error,
            };
        }
    }

    /**
     * Get all workspaces for a user.
     */
    static async getUserWorkspaces(userId: string): Promise<SavedWorkspace[]> {
        try {
            const q = query(
                collection(db, this.COLLECTION),
                where('userId', '==', userId)
            );

            let workspaces: SavedWorkspace[] = [];

            // Try fetch from cloud
            try {
                const snapshot = await getDocs(q);
                workspaces = snapshot.docs.map(doc => this.normalizeWorkspace(doc.data() as SavedWorkspace));
            } catch (cloudError) {
                console.warn('Failed to fetch cloud workspaces, showing local only:', cloudError);
            }

            // Always merge with local for resilience
            const mergedById = new Map<string, SavedWorkspace>();
            workspaces.forEach(workspace => {
                mergedById.set(workspace.id, workspace);
            });

            this.readLocalWorkspaces(userId)
                .filter(workspace => workspace.userId === userId)
                .forEach(localWorkspace => {
                    const existingWorkspace = mergedById.get(localWorkspace.id);
                    mergedById.set(
                        localWorkspace.id,
                        this.preferNewerWorkspace(existingWorkspace, localWorkspace) as SavedWorkspace
                    );
                });

            return Array.from(mergedById.values()).sort((a, b) => this.getWorkspaceTimestamp(b) - this.getWorkspaceTimestamp(a));
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            throw new Error('Failed to fetch workspaces');
        }
    }

    /**
     * Get a single workspace by ID.
     */
    static async getWorkspace(id: string, userId: string): Promise<SavedWorkspace | null> {
        const localWorkspace = this.readLocalWorkspaces(userId).find(workspace => workspace.id === id) || null;

        try {
            const docRef = doc(db, this.COLLECTION, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const cloudWorkspace = this.normalizeWorkspace(docSnap.data() as SavedWorkspace);
                return this.preferNewerWorkspace(cloudWorkspace, localWorkspace);
            }
            return localWorkspace;
        } catch (error) {
            console.error('Error getting workspace, falling back to local copy:', error);
            return localWorkspace;
        }
    }

    /**
     * Delete a workspace.
     */
    static async deleteWorkspace(id: string, userId: string): Promise<void> {
        let cloudDeleted = false;
        let localDeleted = false;

        // Try to delete from Firestore
        try {
            await deleteDoc(doc(db, this.COLLECTION, id));
            cloudDeleted = true;
        } catch (error) {
            console.warn('Failed to delete workspace from cloud:', error);
            // Continue to try local deletion
        }

        // Also delete from localStorage (in case it was saved locally)
        try {
            const existing = this.readLocalWorkspaces(userId);
            const filtered = existing.filter(w => w.id !== id);
            if (filtered.length < existing.length) {
                this.writeLocalWorkspaces(userId, filtered);
                localDeleted = true;
            }
        } catch (localError) {
            console.warn('Failed to delete workspace from local storage:', localError);
        }

        // If neither succeeded, throw an error
        if (!cloudDeleted && !localDeleted) {
            throw new Error('Failed to delete workspace');
        }
    }
}
