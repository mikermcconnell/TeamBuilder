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

export class WorkspaceService {
    private static readonly COLLECTION = 'workspaces';

    /**
     * Recursively removes undefined values from objects and arrays.
     * Firestore doesn't accept undefined values.
     */
    private static removeUndefinedDeep(obj: any): any {
        if (obj === null || obj === undefined) {
            return null;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.removeUndefinedDeep(item));
        }
        if (typeof obj === 'object') {
            const cleaned: Record<string, any> = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
                    cleaned[key] = this.removeUndefinedDeep(obj[key]);
                }
            }
            return cleaned;
        }
        return obj;
    }

    /**
     * Save a workspace to Firestore. Creates new or updates existing.
     */
    static async saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<{ id: string; type: 'cloud' | 'local'; error?: any }> {
        const workspaceId = id || doc(collection(db, this.COLLECTION)).id;
        const now = new Date().toISOString();
        const rawPayload = {
            ...workspace,
            id: workspaceId,
            updatedAt: now,
            createdAt: id ? undefined : now,
        };

        // Recursively remove all undefined values (Firestore doesn't allow them)
        const payload = this.removeUndefinedDeep(rawPayload);

        try {
            const workspaceRef = doc(db, this.COLLECTION, workspaceId);
            await setDoc(workspaceRef, payload, { merge: true });
            return { id: workspaceId, type: 'cloud' };
        } catch (error: any) {
            // Log detailed error info for debugging
            console.error('Error saving workspace to cloud, falling back to local:', {
                error,
                code: error?.code,
                message: error?.message,
                userId: workspace.userId,
                workspaceId
            });

            // Fallback to LocalStorage
            // We need to store it in a list in localStorage to simulate the collection
            const LOCAL_KEY = 'local_saved_workspaces';
            try {
                const existingStr = localStorage.getItem(LOCAL_KEY);
                const existing: SavedWorkspace[] = existingStr ? JSON.parse(existingStr) : [];

                const existingIndex = existing.findIndex(w => w.id === workspaceId);
                const completeWorkspace = payload as unknown as SavedWorkspace;

                if (existingIndex >= 0) {
                    existing[existingIndex] = completeWorkspace;
                } else {
                    existing.push(completeWorkspace);
                }

                try {
                    localStorage.setItem(LOCAL_KEY, JSON.stringify(existing));
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
            const LOCAL_KEY = 'local_saved_workspaces';
            const localStr = localStorage.getItem(LOCAL_KEY);
            if (localStr) {
                const localWorkspaces: SavedWorkspace[] = JSON.parse(localStr);
                // Filter for this user
                const userLocal = localWorkspaces.filter(w => w.userId === userId);

                // Merge strategies: prefer cloud if newer, or simple concat if ID unique?
                // Simple concat unique by ID
                const cloudIds = new Set(workspaces.map(w => w.id));
                userLocal.forEach(w => {
                    if (!cloudIds.has(w.id)) {
                        workspaces.push(w);
                    }
                });
            }

            return workspaces.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            throw new Error('Failed to fetch workspaces');
        }
    }

    /**
     * Get a single workspace by ID.
     */
    static async getWorkspace(id: string): Promise<SavedWorkspace | null> {
        try {
            const docRef = doc(db, this.COLLECTION, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return docSnap.data() as SavedWorkspace;
            }
            return null;
        } catch (error) {
            console.error('Error getting workspace:', error);
            throw new Error('Failed to get workspace');
        }
    }

    /**
     * Delete a workspace.
     */
    static async deleteWorkspace(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, this.COLLECTION, id));
        } catch (error) {
            console.error('Error deleting workspace:', error);
            throw new Error('Failed to delete workspace');
        }
    }
}
