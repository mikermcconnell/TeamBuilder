import { User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { AppState } from '@/types';

export class DataStorageService {
  private user: User | null = null;
  private readonly LOCAL_STORAGE_KEY = 'teamBuilderState';
  private readonly MIGRATION_FLAG_KEY = 'teamBuilderMigrated';

  setUser(user: User | null) {
    this.user = user;
  }

  async save(data: AppState): Promise<void> {
    try {
      if (this.user) {
        // Save to Firestore - clean undefined values
        const cleanData = this.removeUndefinedValues(data);
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');
        await setDoc(userDoc, {
          ...cleanData,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Save to localStorage
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error saving data:', error);
      // Fallback to localStorage on error
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
      throw error;
    }
  }

  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }

    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = this.removeUndefinedValues(obj[key]);
        }
      }
      return cleaned;
    }

    return obj;
  }

  async load(): Promise<AppState | null> {
    try {
      if (this.user) {
        // Try to load from Firestore
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');
        const docSnap = await getDoc(userDoc);

        if (docSnap.exists()) {
          const data = docSnap.data();
          // Remove Firestore metadata
          delete data.lastUpdated;
          return data as AppState;
        }

        // If no Firestore data, check for localStorage data to migrate
        const localData = this.loadFromLocalStorage();
        if (localData && !this.hasMigrated()) {
          // Migrate localStorage data to Firestore
          await this.save(localData);
          this.setMigrationFlag();
          // Clear localStorage after successful migration
          localStorage.removeItem(this.LOCAL_STORAGE_KEY);
          return localData;
        }

        return null;
      } else {
        // Load from localStorage when not signed in
        return this.loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to localStorage on error
      return this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage(): AppState | null {
    const savedState = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.error('Failed to parse localStorage data:', e);
        return null;
      }
    }
    return null;
  }

  private hasMigrated(): boolean {
    return localStorage.getItem(this.MIGRATION_FLAG_KEY) === 'true';
  }

  private setMigrationFlag(): void {
    localStorage.setItem(this.MIGRATION_FLAG_KEY, 'true');
  }

  clearMigrationFlag(): void {
    localStorage.removeItem(this.MIGRATION_FLAG_KEY);
  }

  async clearAll(): Promise<void> {
    // Clear localStorage
    localStorage.removeItem(this.LOCAL_STORAGE_KEY);
    localStorage.removeItem(this.MIGRATION_FLAG_KEY);

    // Clear Firestore if authenticated
    if (this.user) {
      try {
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');
        await setDoc(userDoc, {
          players: [],
          teams: [],
          unassignedPlayers: [],
          playerGroups: [],
          config: null,
          savedConfigs: [],
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error clearing Firestore data:', error);
      }
    }
  }
}

// Create singleton instance
export const dataStorageService = new DataStorageService();