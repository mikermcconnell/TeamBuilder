import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { Team, Player, LeagueConfig } from '@/types';

export interface TeamsData {
  id?: string;
  userId: string;
  rosterId?: string; // Link to the roster used
  name: string;
  description?: string;
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  generationMethod?: 'balanced' | 'random' | 'manual';
  createdAt?: Date;
  updatedAt?: Date;
  isAutoSaved?: boolean;
}

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

    const docRef = await addDoc(collection(db, 'teams'), {
      ...teamsData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
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
    await updateDoc(docRef, {
      ...teamsData,
      updatedAt: Timestamp.now()
    });
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