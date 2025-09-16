import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage, auth } from '../config/firebase';

export interface SavedRoster {
  id: string;
  name: string;
  description?: string;
  csvUrl: string;
  playerCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  fileSize?: number;
  headers?: string[];
}

export class RosterStorageService {
  private static COLLECTION_NAME = 'savedRosters';
  private static STORAGE_PATH = 'rosters';

  /**
   * Save a CSV roster to Firebase Storage and Firestore
   */
  static async saveRoster(
    csvContent: string,
    name: string,
    description?: string,
    headers?: string[]
  ): Promise<SavedRoster> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to save rosters');
    }

    const rosterId = `roster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const storageRef = ref(storage, `${this.STORAGE_PATH}/${user.uid}/${rosterId}.csv`);

    try {
      // Upload CSV to Firebase Storage
      const snapshot = await uploadString(storageRef, csvContent, 'raw');
      const csvUrl = await getDownloadURL(snapshot.ref);

      // Count players (rows minus header)
      const lines = csvContent.trim().split('\n');
      const playerCount = Math.max(0, lines.length - 1);

      // Create roster document
      const rosterData: Omit<SavedRoster, 'id'> = {
        name,
        description: description || '',
        csvUrl,
        playerCount,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        userId: user.uid,
        fileSize: new Blob([csvContent]).size,
        headers: headers || []
      };

      // Save to Firestore
      await setDoc(doc(db, this.COLLECTION_NAME, rosterId), rosterData);

      return {
        id: rosterId,
        ...rosterData
      };
    } catch (error) {
      console.error('Error saving roster:', error);
      throw new Error('Failed to save roster. Please try again.');
    }
  }

  /**
   * Get all saved rosters for the current user
   */
  static async getSavedRosters(): Promise<SavedRoster[]> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to view saved rosters');
    }

    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const rosters: SavedRoster[] = [];

      querySnapshot.forEach((doc) => {
        rosters.push({
          id: doc.id,
          ...doc.data()
        } as SavedRoster);
      });

      return rosters;
    } catch (error) {
      console.error('Error fetching saved rosters:', error);
      throw new Error('Failed to load saved rosters. Please try again.');
    }
  }

  /**
   * Load CSV content from a saved roster
   */
  static async loadRosterContent(csvUrl: string): Promise<string> {
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch CSV content');
      }
      return await response.text();
    } catch (error) {
      console.error('Error loading roster content:', error);
      throw new Error('Failed to load roster content. Please try again.');
    }
  }

  /**
   * Delete a saved roster
   */
  static async deleteRoster(rosterId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to delete rosters');
    }

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, this.COLLECTION_NAME, rosterId));

      // Delete from Storage
      const storageRef = ref(storage, `${this.STORAGE_PATH}/${user.uid}/${rosterId}.csv`);
      try {
        await deleteObject(storageRef);
      } catch (storageError) {
        // File might not exist in storage, continue anyway
        console.warn('Could not delete file from storage:', storageError);
      }
    } catch (error) {
      console.error('Error deleting roster:', error);
      throw new Error('Failed to delete roster. Please try again.');
    }
  }

  /**
   * Update roster metadata
   */
  static async updateRoster(
    rosterId: string,
    updates: Partial<Pick<SavedRoster, 'name' | 'description'>>
  ): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to update rosters');
    }

    try {
      await setDoc(
        doc(db, this.COLLECTION_NAME, rosterId),
        {
          ...updates,
          updatedAt: Timestamp.now()
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error updating roster:', error);
      throw new Error('Failed to update roster. Please try again.');
    }
  }
}