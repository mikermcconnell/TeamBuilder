import { User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { AppState } from '@/types';
import { cleanUndefinedDeep } from './persistence/cleanup';
import { buildLocalStorageKey, readFirstLocalStorageValue } from './persistence/localKeys';

interface LocalAppStateSnapshot {
  data: AppState;
  lastUpdated: string;
}

export class DataStorageService {
  private user: User | null = null;
  private readonly LEGACY_LOCAL_STORAGE_KEY = 'teamBuilderState';
  private readonly ANONYMOUS_LOCAL_STORAGE_KEY = 'teamBuilderState:anonymous';

  setUser(user: User | null) {
    this.user = user;
  }

  private getLocalStorageKey(): string {
    if (!this.user) {
      return this.ANONYMOUS_LOCAL_STORAGE_KEY;
    }

    return buildLocalStorageKey(this.LEGACY_LOCAL_STORAGE_KEY, 'user', this.user.uid);
  }

  async save(data: AppState): Promise<{ type: 'cloud' | 'local'; error?: unknown }> {
    const lastUpdated = new Date().toISOString();

    try {
      if (this.user) {
        const cleanData = cleanUndefinedDeep(data) as Record<string, unknown>;
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');

        await setDoc(userDoc, {
          ...cleanData,
          lastUpdated
        });

        this.saveToLocalStorage(data, lastUpdated);
        return { type: 'cloud' };
      }

      this.saveToLocalStorage(data, lastUpdated);
      return { type: 'local' };
    } catch (error) {
      console.error('Error saving data:', error);
      this.saveToLocalStorage(data, lastUpdated);
      return { type: 'local', error };
    }
  }

  async load(): Promise<AppState | null> {
    const localSnapshot = this.loadFromLocalStorage();

    try {
      if (this.user) {
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');
        const docSnap = await getDoc(userDoc);

        if (docSnap.exists()) {
          const { data: cloudData, lastUpdated: cloudLastUpdated } = this.extractCloudSnapshot(docSnap.data());

          if (localSnapshot && this.isLocalSnapshotNewer(localSnapshot.lastUpdated, cloudLastUpdated)) {
            await this.save(localSnapshot.data);
            return localSnapshot.data;
          }

          return cloudData;
        }

        if (localSnapshot) {
          await this.save(localSnapshot.data);
          return localSnapshot.data;
        }

        return null;
      }

      return localSnapshot?.data ?? null;
    } catch (error) {
      console.error('Error loading data:', error);
      return localSnapshot?.data ?? null;
    }
  }

  private extractCloudSnapshot(rawData: Record<string, unknown>): LocalAppStateSnapshot {
    const data = { ...rawData };
    const lastUpdated = typeof data.lastUpdated === 'string' ? data.lastUpdated : '';
    delete data.lastUpdated;

    return {
      data: data as AppState,
      lastUpdated,
    };
  }

  private saveToLocalStorage(data: AppState, lastUpdated: string): void {
    const snapshot: LocalAppStateSnapshot = {
      data,
      lastUpdated,
    };

    localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(snapshot));
  }

  private loadFromLocalStorage(): LocalAppStateSnapshot | null {
    const localStorageKey = this.getLocalStorageKey();
    const savedState = readFirstLocalStorageValue([
      localStorageKey,
      ...(!this.user ? [this.LEGACY_LOCAL_STORAGE_KEY] : []),
    ]);

    if (!savedState) {
      return null;
    }

    try {
      const parsed = JSON.parse(savedState);

      if (parsed && typeof parsed === 'object' && 'data' in parsed && 'lastUpdated' in parsed) {
        return parsed as LocalAppStateSnapshot;
      }

      return {
        data: parsed as AppState,
        lastUpdated: '',
      };
    } catch (error) {
      console.error('Failed to parse localStorage data:', error);
      return null;
    }
  }

  private isLocalSnapshotNewer(localLastUpdated: string, cloudLastUpdated: string): boolean {
    if (!localLastUpdated) {
      return false;
    }

    if (!cloudLastUpdated) {
      return true;
    }

    const localTimestamp = new Date(localLastUpdated).getTime();
    const cloudTimestamp = new Date(cloudLastUpdated).getTime();

    if (Number.isNaN(localTimestamp) || Number.isNaN(cloudTimestamp)) {
      return false;
    }

    return localTimestamp > cloudTimestamp;
  }

  async clearAll(): Promise<void> {
    localStorage.removeItem(this.getLocalStorageKey());

    if (!this.user) {
      localStorage.removeItem(this.LEGACY_LOCAL_STORAGE_KEY);
    }

    if (this.user) {
      try {
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');
        await setDoc(userDoc, {
          players: [],
          teams: [],
          unassignedPlayers: [],
          playerGroups: [],
          config: null,
          execRatingHistory: {},
          savedConfigs: [],
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error clearing Firestore data:', error);
      }
    }
  }
}

export const dataStorageService = new DataStorageService();
