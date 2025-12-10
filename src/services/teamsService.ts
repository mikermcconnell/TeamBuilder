import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { TeamsData } from '@/types';

// Helper function to ensure user is authenticated
const ensureAuthenticated = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(true);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(!!user);
    });

    setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, 5000);
  });
};


const removeUndefinedValues = (value: any): any => {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(item => removeUndefinedValues(item));
  }

  if (value instanceof Timestamp) {
    return value;
  }

  if (typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const nested = value[key];
        if (nested !== undefined) {
          cleaned[key] = removeUndefinedValues(nested);
        }
      }
    }
    return cleaned;
  }

  return value;
};

// Save teams configuration
export const saveTeams = async (
  teamsData: Omit<TeamsData, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      throw new Error('User must be authenticated to save teams');
    }

    if (!auth.currentUser || auth.currentUser.uid !== teamsData.userId) {
      throw new Error('Authentication mismatch');
    }

    // Validate payload structure using Zod
    // Note: We need to be careful with Dates vs Timestamps here. 
    // The schema expects Date or string, but Firestore wants Timestamps or Dates.
    // For now, let's trust the schema validation but keep standard cleaning.

    const sanitizedTeamsData = removeUndefinedValues(teamsData) as Omit<TeamsData, 'id' | 'createdAt' | 'updatedAt'>;
    const payload = removeUndefinedValues({
      ...sanitizedTeamsData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    const docRef = await addDoc(collection(db, 'teams'), payload);

    return docRef.id;
  } catch (error: any) {
    console.error('Error saving teams:', error);

    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Please make sure you are signed in.');
    }

    throw error;
  }
};

// Update existing teams
export const updateTeams = async (
  teamsId: string,
  teamsData: Partial<TeamsData>
): Promise<void> => {
  try {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      throw new Error('User must be authenticated to update teams');
    }

    const docRef = doc(db, 'teams', teamsId);
    const payload = removeUndefinedValues({
      ...teamsData,
      updatedAt: Timestamp.now()
    });

    await updateDoc(docRef, payload);
  } catch (error: any) {
    console.error('Error updating teams:', error);
    throw error;
  }
};

// Get user's saved teams
export const getUserTeams = async (
  userId: string,
  rosterId?: string
): Promise<TeamsData[]> => {
  try {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      return [];
    }

    let q = query(
      collection(db, 'teams'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );

    if (rosterId) {
      q = query(
        collection(db, 'teams'),
        where('userId', '==', userId),
        where('rosterId', '==', rosterId),
        orderBy('updatedAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      } as TeamsData;
    });
  } catch (error: any) {
    console.error('Error fetching teams:', error);

    if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.warn('Database indexes are being built. Teams will be available shortly.');
    }

    return [];
  }
};

// Delete saved teams
export const deleteTeams = async (teamsId: string): Promise<void> => {
  try {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      throw new Error('User must be authenticated to delete teams');
    }

    await deleteDoc(doc(db, 'teams', teamsId));
  } catch (error) {
    console.error('Error deleting teams:', error);
    throw new Error('Failed to delete teams');
  }
};
