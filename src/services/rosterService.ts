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
import { Player, PlayerGroup, Team, LeagueConfig } from '@/types';
import { uploadFile, downloadFile, deleteFile } from './storageService';

// Helper function to remove undefined values from an object
const removeUndefinedValues = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefinedValues(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

// Helper function to ensure user is authenticated
const ensureAuthenticated = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(true);
      return;
    }

    // Wait for auth state to be determined
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(!!user);
    });

    // Timeout after 5 seconds to avoid hanging
    setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, 5000);
  });
};

export interface RosterData {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  players: Player[];
  playerGroups?: PlayerGroup[];
  tags?: string[];
  sport?: string;
  season?: string;
  version: number;
  csvUrl?: string;
  thumbnailUrl?: string;
  metadata?: {
    totalPlayers: number;
    avgSkillRating: number;
    genderBreakdown: { M: number; F: number; Other: number };
    hasGroups: boolean;
    importSource?: 'csv' | 'manual' | 'clone';
    hasTeams?: boolean;
    teamsCount?: number;
  };
  // Teams data - stored within the roster
  teams?: Team[];
  unassignedPlayers?: Player[];
  teamsConfig?: LeagueConfig;
  teamsGeneratedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  lastAccessedAt?: Date;
  isArchived?: boolean;
  isTemplate?: boolean;
  sharedWith?: string[];
}

export interface RosterTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  players: Player[];
  playerGroups?: PlayerGroup[];
  isPublic: boolean;
  usageCount: number;
  createdBy: string;
  createdAt?: Date;
}

// Save a new roster
export const saveRoster = async (
  rosterData: Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'>
): Promise<string> => {
  try {
    // Ensure user is authenticated before making Firestore calls
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.warn('User not authenticated for saveRoster');
      throw new Error('User must be authenticated to save roster');
    }

    // Verify the current user matches the userId in the data
    if (!auth.currentUser || auth.currentUser.uid !== rosterData.userId) {
      console.error('User ID mismatch or no authenticated user');
      throw new Error('Authentication mismatch - cannot save roster');
    }

    // Clean data to avoid undefined values and calculate metadata
    const cleanedRosterData = removeUndefinedValues(rosterData) as Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'>;
    const metadata = calculateRosterMetadata(
      cleanedRosterData.players,
      cleanedRosterData.playerGroups
    );

    const docRef = await addDoc(collection(db, 'rosters'), {
      ...cleanedRosterData,
      metadata,
      version: 1,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastAccessedAt: Timestamp.now(),
      isArchived: false
    });

    return docRef.id;
  } catch (error: any) {
    console.error('Error saving roster:', error);

    // Handle specific Firebase errors
    if (error?.code === 'permission-denied') {
      throw new Error('Permission denied. Please make sure you are signed in.');
    } else if (error?.code === 'unavailable') {
      throw new Error('Service temporarily unavailable. Please try again.');
    }

    throw error;
  }
};

// Save teams to an existing roster
export const saveTeamsToRoster = async (
  rosterId: string,
  teams: Team[],
  unassignedPlayers: Player[],
  config: LeagueConfig
): Promise<void> => {
  try {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      throw new Error('User must be authenticated to save teams');
    }

    const docRef = doc(db, 'rosters', rosterId);

    // Clean all data to remove undefined values
    const cleanedTeams = removeUndefinedValues(teams || []);
    const cleanedUnassignedPlayers = removeUndefinedValues(unassignedPlayers || []);
    const cleanedConfig = removeUndefinedValues(config || {});

    // Build update data with cleaned values
    const updateData: any = {
      teams: cleanedTeams,
      unassignedPlayers: cleanedUnassignedPlayers,
      teamsConfig: cleanedConfig,
      teamsGeneratedAt: Timestamp.now(),
      'metadata.hasTeams': true,
      'metadata.teamsCount': cleanedTeams.length,
      updatedAt: Timestamp.now()
    };

    await updateDoc(docRef, updateData);
  } catch (error: any) {
    console.error('Error saving teams to roster:', error);
    throw new Error('Failed to save teams');
  }
};

// Update an existing roster (creates a new version)
export const updateRoster = async (
  rosterId: string,
  rosterData: Partial<RosterData>,
  createNewVersion: boolean = true
): Promise<void> => {
  try {
    const docRef = doc(db, 'rosters', rosterId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Roster not found');
    }

    const currentData = docSnap.data();
    const newVersion = createNewVersion ? (currentData.version || 1) + 1 : currentData.version || 1;

    // If creating a new version, save the old version
    if (createNewVersion) {
      await saveRosterVersion(rosterId, currentData);
    }

    const cleanedRosterData = removeUndefinedValues(rosterData) as Partial<RosterData>;

    // Recalculate metadata if players changed
    let metadata = currentData.metadata;
    if (cleanedRosterData.players || cleanedRosterData.playerGroups) {
      metadata = calculateRosterMetadata(
        cleanedRosterData.players || currentData.players,
        cleanedRosterData.playerGroups || currentData.playerGroups
      );
    }

    await updateDoc(docRef, {
      ...cleanedRosterData,
      metadata,
      version: newVersion,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating roster:', error);
    throw new Error('Failed to update roster');
  }
};

// Save a roster version (for version history)
const saveRosterVersion = async (rosterId: string, rosterData: any): Promise<void> => {
  try {
    // Ensure userId is always included for security rule compliance
    const userId = rosterData.userId || auth.currentUser?.uid;
    if (!userId) {
      console.warn('Cannot save roster version without userId');
      return;
    }

    await addDoc(collection(db, 'rosterVersions'), {
      rosterId,
      ...rosterData,
      userId, // Explicitly set for security rules
      versionedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error saving roster version:', error);
  }
};

// Get all rosters for a user
export const getUserRosters = async (
  userId: string,
  includeArchived: boolean = false
): Promise<RosterData[]> => {
  try {
    // Check if we have a valid userId
    if (!userId) {
      console.warn('No userId provided to getUserRosters');
      return [];
    }

    // Ensure user is authenticated before making Firestore calls
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.warn('User not authenticated for getUserRosters');
      return [];
    }

    let q = query(
      collection(db, 'rosters'),
      where('userId', '==', userId)
    );

    if (!includeArchived) {
      q = query(q, where('isArchived', '==', false));
    }

    q = query(q, orderBy('lastAccessedAt', 'desc'), limit(50));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastAccessedAt: data.lastAccessedAt?.toDate()
      } as RosterData;
    });
  } catch (error: any) {
    console.error('Error fetching user rosters:', error);

    // Handle specific Firebase errors
    if (error?.code === 'permission-denied') {
      console.warn('Permission denied accessing rosters. User may not be authenticated properly.');
    } else if (error?.code === 'unavailable') {
      console.warn('Firestore temporarily unavailable.');
    } else if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.warn('Database indexes are being built. This may take a few minutes. Please try again shortly.');
    }

    return [];
  }
};

// Get a single roster by ID
export const getRoster = async (rosterId: string): Promise<RosterData | null> => {
  try {
    const docRef = doc(db, 'rosters', rosterId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Update last accessed time
      await updateDoc(docRef, {
        lastAccessedAt: Timestamp.now()
      });

      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastAccessedAt: data.lastAccessedAt?.toDate()
      } as RosterData;
    }

    return null;
  } catch (error) {
    console.error('Error fetching roster:', error);
    return null;
  }
};

// Delete a roster
export const deleteRoster = async (rosterId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'rosters', rosterId));
  } catch (error) {
    console.error('Error deleting roster:', error);
    throw new Error('Failed to delete roster');
  }
};

// Archive/unarchive a roster
export const archiveRoster = async (rosterId: string, isArchived: boolean): Promise<void> => {
  try {
    const docRef = doc(db, 'rosters', rosterId);
    await updateDoc(docRef, {
      isArchived,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error archiving roster:', error);
    throw new Error('Failed to archive roster');
  }
};

// Duplicate a roster
export const duplicateRoster = async (
  rosterId: string,
  userId: string,
  newName: string
): Promise<string> => {
  try {
    const originalRoster = await getRoster(rosterId);
    if (!originalRoster) {
      throw new Error('Original roster not found');
    }

    const newRosterData: Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'> = {
      ...originalRoster,
      userId,
      name: newName,
      description: `Duplicated from: ${originalRoster.name}`,
      isTemplate: false,
      sharedWith: []
    };

    return await saveRoster(newRosterData);
  } catch (error) {
    console.error('Error duplicating roster:', error);
    throw new Error('Failed to duplicate roster');
  }
};

// Search rosters
export const searchRosters = async (
  userId: string,
  searchTerm: string,
  filters?: {
    sport?: string;
    season?: string;
    tags?: string[];
    hasGroups?: boolean;
  }
): Promise<RosterData[]> => {
  try {
    let q = query(
      collection(db, 'rosters'),
      where('userId', '==', userId),
      where('isArchived', '==', false)
    );

    if (filters?.sport) {
      q = query(q, where('sport', '==', filters.sport));
    }

    if (filters?.season) {
      q = query(q, where('season', '==', filters.season));
    }

    if (filters?.hasGroups !== undefined) {
      q = query(q, where('metadata.hasGroups', '==', filters.hasGroups));
    }

    const snapshot = await getDocs(q);
    let results = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastAccessedAt: data.lastAccessedAt?.toDate()
      } as RosterData;
    });

    // Client-side filtering for name/description search and tags
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(roster =>
        roster.name.toLowerCase().includes(term) ||
        roster.description?.toLowerCase().includes(term)
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(roster =>
        filters.tags!.some(tag => roster.tags?.includes(tag))
      );
    }

    return results;
  } catch (error) {
    console.error('Error searching rosters:', error);
    return [];
  }
};

// Get roster templates
export const getRosterTemplates = async (category?: string): Promise<RosterTemplate[]> => {
  try {
    let q = query(
      collection(db, 'rosterTemplates'),
      where('isPublic', '==', true)
    );

    if (category) {
      q = query(q, where('category', '==', category));
    }

    q = query(q, orderBy('usageCount', 'desc'), limit(20));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate()
      } as RosterTemplate;
    });
  } catch (error) {
    console.error('Error fetching roster templates:', error);
    return [];
  }
};

// Create roster from template
export const createFromTemplate = async (
  templateId: string,
  userId: string,
  rosterName: string
): Promise<string> => {
  try {
    const templateDoc = await getDoc(doc(db, 'rosterTemplates', templateId));

    if (!templateDoc.exists()) {
      throw new Error('Template not found');
    }

    const template = templateDoc.data() as RosterTemplate;

    // Increment template usage count
    await updateDoc(doc(db, 'rosterTemplates', templateId), {
      usageCount: (template.usageCount || 0) + 1
    });

    // Create new roster from template
    const rosterData: Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'> = {
      userId,
      name: rosterName,
      description: `Created from template: ${template.name}`,
      players: template.players,
      playerGroups: template.playerGroups,
      tags: [`template-${template.category}`],
      isTemplate: false
    };

    return await saveRoster(rosterData);
  } catch (error) {
    console.error('Error creating from template:', error);
    throw new Error('Failed to create roster from template');
  }
};

// Export roster to JSON
export const exportRosterToJSON = (roster: RosterData): string => {
  const exportData = {
    name: roster.name,
    description: roster.description,
    players: roster.players,
    playerGroups: roster.playerGroups,
    sport: roster.sport,
    season: roster.season,
    tags: roster.tags,
    exportedAt: new Date().toISOString(),
    version: roster.version
  };

  return JSON.stringify(exportData, null, 2);
};

// Import roster from JSON
export const importRosterFromJSON = async (
  jsonString: string,
  userId: string
): Promise<RosterData> => {
  try {
    const importData = JSON.parse(jsonString);

    if (!importData.players || !Array.isArray(importData.players)) {
      throw new Error('Invalid roster format: missing players array');
    }

    const rosterData: Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'> = {
      userId,
      name: importData.name || 'Imported Roster',
      description: importData.description || `Imported on ${new Date().toLocaleDateString()}`,
      players: importData.players,
      playerGroups: importData.playerGroups || [],
      sport: importData.sport,
      season: importData.season,
      tags: importData.tags || ['imported'],
      isTemplate: false
    };

    const rosterId = await saveRoster(rosterData);
    const roster = await getRoster(rosterId);

    if (!roster) {
      throw new Error('Failed to retrieve imported roster');
    }

    return roster;
  } catch (error) {
    console.error('Error importing roster:', error);
    throw new Error('Failed to import roster from JSON');
  }
};

// Helper function to calculate roster metadata
const calculateRosterMetadata = (
  players: Player[],
  playerGroups?: PlayerGroup[]
): RosterData['metadata'] => {
  const totalPlayers = players.length;
  const avgSkillRating = totalPlayers > 0
    ? players.reduce((sum, p) => sum + p.skillRating, 0) / totalPlayers
    : 0;

  const genderBreakdown = { M: 0, F: 0, Other: 0 };
  players.forEach(player => {
    genderBreakdown[player.gender]++;
  });

  return {
    totalPlayers,
    avgSkillRating: Math.round(avgSkillRating * 10) / 10,
    genderBreakdown,
    hasGroups: !!(playerGroups && playerGroups.length > 0)
  };
};

// Get recent rosters (for quick access)
export const getRecentRosters = async (userId: string, limitCount: number = 5): Promise<RosterData[]> => {
  try {
    // Check if we have a valid userId
    if (!userId) {
      console.warn('No userId provided to getRecentRosters');
      return [];
    }

    // Ensure user is authenticated before making Firestore calls
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.warn('User not authenticated for getRecentRosters');
      return [];
    }

    const q = query(
      collection(db, 'rosters'),
      where('userId', '==', userId),
      where('isArchived', '==', false),
      orderBy('lastAccessedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastAccessedAt: data.lastAccessedAt?.toDate()
      } as RosterData;
    });
  } catch (error: any) {
    console.error('Error fetching recent rosters:', error);

    // Handle specific Firebase errors
    if (error?.code === 'permission-denied') {
      console.warn('Permission denied accessing recent rosters. User may not be authenticated properly.');
    } else if (error?.code === 'unavailable') {
      console.warn('Firestore temporarily unavailable.');
    } else if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.warn('Database indexes are being built. This may take a few minutes. Please try again shortly.');
    }

    return [];
  }
};