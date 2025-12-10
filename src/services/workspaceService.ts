import { db } from '@/config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    deleteDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { SavedWorkspace } from '@/types';

export class WorkspaceService {
    private static readonly COLLECTION = 'workspaces';

    /**
     * Save a workspace to Firestore. Creates new or updates existing.
     */
    static async saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<string> {
        try {
            const workspaceId = id || doc(collection(db, this.COLLECTION)).id;
            const workspaceRef = doc(db, this.COLLECTION, workspaceId);

            const now = new Date().toISOString();
            const payload = {
                ...workspace,
                id: workspaceId,
                updatedAt: now,
                createdAt: id ? undefined : now, // Only set createdAt on creation
            };

            // Remove undefined fields
            Object.keys(payload).forEach(key => payload[key as keyof typeof payload] === undefined && delete payload[key as keyof typeof payload]);

            // If updating, we merge. If creating, we set.
            await setDoc(workspaceRef, payload, { merge: true });

            return workspaceId;
        } catch (error) {
            console.error('Error saving workspace:', error);
            throw new Error('Failed to save workspace');
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
                // Note: Composite index might be needed for orderBy('updatedAt', 'desc'). 
                // We'll sort in memory for now to avoid blocking on index creation.
            );

            const snapshot = await getDocs(q);
            const workspaces = snapshot.docs.map(doc => doc.data() as SavedWorkspace);

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
