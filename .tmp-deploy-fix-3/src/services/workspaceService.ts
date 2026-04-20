import { db } from '@/config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    deleteDoc
} from 'firebase/firestore';
import { SavedWorkspace } from '@/types';
import { cleanUndefinedDeep } from './persistence/cleanup';
import { buildLocalStorageKey, readFirstLocalStorageValue } from './persistence/localKeys';

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
            return parsed.filter(workspace => workspace.userId === userId);
        } catch (error) {
            console.warn('Failed to read local workspaces:', error);
            return [];
        }
    }

    private static writeLocalWorkspaces(userId: string, workspaces: SavedWorkspace[]): void {
        localStorage.setItem(this.getLocalKey(userId), JSON.stringify(workspaces));
    }

    private static getWorkspaceTimestamp(workspace?: SavedWorkspace | null): number {
        if (!workspace?.updatedAt) {
            return 0;
        }

        const timestamp = new Date(workspace.updatedAt).getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    private static preferNewerWorkspace(first?: SavedWorkspace | null, second?: SavedWorkspace | null): SavedWorkspace | null {
        if (!first) return second ?? null;
        if (!second) return first;
        return this.getWorkspaceTimestamp(second) > this.getWorkspaceTimestamp(first) ? second : first;
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
    static async saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<{ id: string; type: 'cloud' | 'local'; error?: unknown }> {
        const workspaceId = id || doc(collection(db, this.COLLECTION)).id;
        const now = new Date().toISOString();
        const existingLocalWorkspace = this.readLocalWorkspaces(workspace.userId).find(w => w.id === workspaceId);
        const rawPayload = {
            ...workspace,
            id: workspaceId,
            updatedAt: now,
            createdAt: existingLocalWorkspace?.createdAt || now,
        };

        // Recursively remove all undefined values (Firestore doesn't allow them)
        const payload = cleanUndefinedDeep(rawPayload) as SavedWorkspace;

        try {
            const workspaceRef = doc(db, this.COLLECTION, workspaceId);
            await setDoc(workspaceRef, payload, { merge: true });
            this.upsertLocalWorkspace(payload);
            return { id: workspaceId, type: 'cloud' };
        } catch (error: unknown) {
            // Log detailed error info for debugging
            console.error('Error saving workspace to cloud, falling back to local:', {
                error,
                code: error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined,
                message: error instanceof Error ? error.message : undefined,
                userId: workspace.userId,
                workspaceId
            });

            // Fallback to LocalStorage
            // We need to store it in a list in localStorage to simulate the collection
            try {
                try {
                    this.upsertLocalWorkspace(payload);
                } catch (storageError) {
                    // Handle localStorage quota exceeded
                    if (storageError instanceof DOMException &&
                        (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
                        throw new Error('Local storage is full. Please delete old projects or sign in for cloud storage.');
                    }
                    throw storageError;
                }
                return { id: workspaceId, type: 'local', error };
            } catch (localError) {
                console.error('Failed to save locally:', localError);
                throw localError instanceof Error ? localError : new Error('Failed to save project everywhere');
            }
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
                workspaces = snapshot.docs.map(doc => doc.data() as SavedWorkspace);
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

            return Array.from(mergedById.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
                const cloudWorkspace = docSnap.data() as SavedWorkspace;
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
