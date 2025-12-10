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
     * Save a workspace to Firestore. Creates new or updates existing.
     */
    static async saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<{ id: string; type: 'cloud' | 'local'; error?: any }> {
        const workspaceId = id || doc(collection(db, this.COLLECTION)).id;
        const now = new Date().toISOString();
        const payload = {
            ...workspace,
            id: workspaceId,
            updatedAt: now,
            createdAt: id ? undefined : now,
        };

        // Remove undefined fields
        Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

        try {
            const workspaceRef = doc(db, this.COLLECTION, workspaceId);
            await setDoc(workspaceRef, payload, { merge: true });
            return { id: workspaceId, type: 'cloud' };
        } catch (error) {
            console.error('Error saving workspace to cloud, falling back to local:', error);

            // Fallback to LocalStorage
            // We need to store it in a list in localStorage to simulate the collection
            const LOCAL_KEY = 'local_saved_workspaces';
            try {
                const existingStr = localStorage.getItem(LOCAL_KEY);
                const existing: SavedWorkspace[] = existingStr ? JSON.parse(existingStr) : [];

                const existingIndex = existing.findIndex(w => w.id === workspaceId);
                const completeWorkspace = payload as SavedWorkspace;

                if (existingIndex >= 0) {
                    existing[existingIndex] = completeWorkspace;
                } else {
                    existing.push(completeWorkspace);
                }

                localStorage.setItem(LOCAL_KEY, JSON.stringify(existing));
                return { id: workspaceId, type: 'local', error };
            } catch (localError) {
                console.error('Failed to save locally:', localError);
                throw new Error('Failed to save project everywhere');
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
