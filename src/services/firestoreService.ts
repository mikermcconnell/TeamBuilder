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
import { db } from '@/config/firebase';
import { Player, Team, LeagueConfig, PlayerGroup } from '@/types';
import { auth } from '@/config/firebase';
import { ensureCurrentUserMatches, waitForAuthenticatedUser } from './persistence/authGuards';

export interface SessionData {
  id?: string;
  userId: string;
  name: string;
  players: Player[];
  teams: Team[];
  unassignedPlayers: Player[];
  playerGroups: PlayerGroup[];
  config: LeagueConfig;
  csvUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Save a new session
export const saveSession = async (sessionData: Omit<SessionData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const isAuthorized = await ensureCurrentUserMatches(auth, sessionData.userId);
    if (!isAuthorized) {
      throw new Error('Authentication mismatch');
    }

    const docRef = await addDoc(collection(db, 'sessions'), {
      ...sessionData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving session:', error);
    throw new Error('Failed to save session');
  }
};

// Update an existing session
export const updateSession = async (sessionId: string, sessionData: Partial<SessionData>): Promise<void> => {
  try {
    const currentUser = await waitForAuthenticatedUser(auth);
    if (!currentUser) {
      throw new Error('User must be authenticated to update session');
    }

    if (sessionData.userId && sessionData.userId !== currentUser.uid) {
      throw new Error('Authentication mismatch');
    }

    const docRef = doc(db, 'sessions', sessionId);
    await updateDoc(docRef, {
      ...sessionData,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating session:', error);
    throw new Error('Failed to update session');
  }
};

// Get all sessions for a user
export const getUserSessions = async (userId: string): Promise<SessionData[]> => {
  try {
    const isAuthorized = await ensureCurrentUserMatches(auth, userId);
    if (!isAuthorized) {
      return [];
    }

    const q = query(
      collection(db, 'sessions'), 
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      } as SessionData;
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return [];
  }
};

// Get a single session by ID
export const getSession = async (sessionId: string): Promise<SessionData | null> => {
  try {
    const currentUser = await waitForAuthenticatedUser(auth);
    if (!currentUser) {
      return null;
    }

    const docRef = doc(db, 'sessions', sessionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      } as SessionData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
};

// Delete a session
export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    const currentUser = await waitForAuthenticatedUser(auth);
    if (!currentUser) {
      throw new Error('User must be authenticated to delete session');
    }

    await deleteDoc(doc(db, 'sessions', sessionId));
  } catch (error) {
    console.error('Error deleting session:', error);
    throw new Error('Failed to delete session');
  }
};

// Save quick configuration preset
export const saveConfigPreset = async (userId: string, config: LeagueConfig): Promise<string> => {
  try {
    const isAuthorized = await ensureCurrentUserMatches(auth, userId);
    if (!isAuthorized) {
      throw new Error('Authentication mismatch');
    }

    const docRef = await addDoc(collection(db, 'configPresets'), {
      userId,
      config,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving config preset:', error);
    throw new Error('Failed to save configuration preset');
  }
};

// Get user's configuration presets
export const getUserConfigPresets = async (userId: string): Promise<LeagueConfig[]> => {
  try {
    const isAuthorized = await ensureCurrentUserMatches(auth, userId);
    if (!isAuthorized) {
      return [];
    }

    const q = query(
      collection(db, 'configPresets'), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().config as LeagueConfig);
  } catch (error) {
    console.error('Error fetching config presets:', error);
    return [];
  }
};
