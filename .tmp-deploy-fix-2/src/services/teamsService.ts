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
import { waitForAuthenticatedUser, ensureCurrentUserMatches } from './persistence/authGuards';
import { cleanUndefinedDeep } from './persistence/cleanup';
import { getFirebaseErrorCode, isFirestoreIndexError } from './persistence/firebaseErrors';

// Save teams configuration
export const saveTeams = async (
  teamsData: Omit<TeamsData, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const currentUser = await waitForAuthenticatedUser(auth);
    if (!currentUser) {
      throw new Error('User must be authenticated to save teams');
    }

    if (currentUser.uid !== teamsData.userId) {
      throw new Error('Authentication mismatch');
    }

    // Validate payload structure using Zod
    // Note: We need to be careful with Dates vs Timestamps here. 
    // The schema expects Date or string, but Firestore wants Timestamps or Dates.
    // For now, let's trust the schema validation but keep standard cleaning.

    const sanitizedTeamsData = cleanUndefinedDeep(teamsData, {
      preserve: (value) => value instanceof Timestamp,
    }) as Omit<TeamsData, 'id' | 'createdAt' | 'updatedAt'>;
    const payload = cleanUndefinedDeep({
      ...sanitizedTeamsData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }, {
      preserve: (value) => value instanceof Timestamp,
    });

    const docRef = await addDoc(collection(db, 'teams'), payload);

    return docRef.id;
  } catch (error: unknown) {
    console.error('Error saving teams:', error);

    if (getFirebaseErrorCode(error) === 'permission-denied') {
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
    const currentUser = await waitForAuthenticatedUser(auth);
    if (!currentUser) {
      throw new Error('User must be authenticated to update teams');
    }

    if (teamsData.userId && teamsData.userId !== currentUser.uid) {
      throw new Error('Authentication mismatch');
    }

    const docRef = doc(db, 'teams', teamsId);
    const payload = cleanUndefinedDeep({
      ...teamsData,
      updatedAt: Timestamp.now()
    }, {
      preserve: (value) => value instanceof Timestamp,
    });

    await updateDoc(docRef, payload);
  } catch (error: unknown) {
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
    const isAuthorized = await ensureCurrentUserMatches(auth, userId, {
      onMismatchMessage: 'Blocked teams query for mismatched userId',
    });
    if (!isAuthorized) {
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
  } catch (error: unknown) {
    console.error('Error fetching teams:', error);

    if (isFirestoreIndexError(error)) {
      console.warn('Database indexes are being built. Teams will be available shortly.');
    }

    return [];
  }
};

// Delete saved teams
export const deleteTeams = async (teamsId: string): Promise<void> => {
  try {
    const currentUser = await waitForAuthenticatedUser(auth);
    if (!currentUser) {
      throw new Error('User must be authenticated to delete teams');
    }

    await deleteDoc(doc(db, 'teams', teamsId));
  } catch (error) {
    console.error('Error deleting teams:', error);
    throw new Error('Failed to delete teams');
  }
};
