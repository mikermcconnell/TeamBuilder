import { User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { AppState } from '@/types';
import { cleanUndefinedDeep } from './persistence/cleanup';
import { buildLocalStorageKey, readFirstLocalStorageValue } from './persistence/localKeys';
import type { SaveResult, SaveTargetResult } from './persistence/saveTypes';
import { sanitizeAppStateForLocalCache } from './persistence/localCacheSanitizer';

interface LocalAppStateSnapshot {
  data: AppState;
  lastUpdated: string;
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return typeof value === 'string' ? value : '';
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

  async save(data: AppState): Promise<SaveResult> {
    const lastUpdated = new Date().toISOString();
    const localResult = this.trySaveToLocalStorage(data, lastUpdated);
    const cloudResult: SaveTargetResult = {
      attempted: Boolean(this.user),
      saved: false,
    };

    try {
      if (this.user) {
        const cleanData = cleanUndefinedDeep(data) as Record<string, unknown>;
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');

        await setDoc(userDoc, {
          ...cleanData,
          lastUpdated,
          updatedAtServer: serverTimestamp(),
        });

        cloudResult.saved = true;
      }
    } catch (error) {
      console.error('Error saving data:', error);
      cloudResult.error = error;
    }

    if (cloudResult.saved) {
      return {
        type: 'cloud',
        local: localResult,
        cloud: cloudResult,
        ...(localResult.error ? { error: localResult.error } : {}),
      };
    }

    if (localResult.saved) {
      return {
        type: 'local',
        local: localResult,
        cloud: cloudResult,
        error: cloudResult.error,
      };
    }

    return {
      type: 'error',
      local: localResult,
      cloud: cloudResult,
      error: cloudResult.error ?? localResult.error,
    };
  }

  async load(): Promise<AppState | null> {
    const localSnapshot = this.loadFromLocalStorage();

    try {
      if (this.user) {
        const userDoc = doc(db, 'users', this.user.uid, 'data', 'appState');
        const docSnap = await getDoc(userDoc);

        if (docSnap.exists()) {
          const { data: cloudData, lastUpdated: cloudLastUpdated, updatedAtServer } = this.extractCloudSnapshot(docSnap.data());

          if (localSnapshot && this.isLocalSnapshotNewer(localSnapshot.lastUpdated, updatedAtServer || cloudLastUpdated)) {
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

  private extractCloudSnapshot(rawData: Record<string, unknown>): LocalAppStateSnapshot & { updatedAtServer: string } {
    const data = { ...rawData };
    const lastUpdated = typeof data.lastUpdated === 'string' ? data.lastUpdated : '';
    const updatedAtServer = toIsoString(data.updatedAtServer);
    delete data.lastUpdated;
    delete data.updatedAtServer;

    return {
      data: data as AppState,
      lastUpdated,
      updatedAtServer,
    };
  }

  private saveToLocalStorage(data: AppState, lastUpdated: string): void {
    const snapshot: LocalAppStateSnapshot = {
      data: sanitizeAppStateForLocalCache(data),
      lastUpdated,
    };

    localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(snapshot));
  }

  private trySaveToLocalStorage(data: AppState, lastUpdated: string): SaveTargetResult {
    try {
      this.saveToLocalStorage(data, lastUpdated);
      return {
        attempted: true,
        saved: true,
      };
    } catch (error) {
      console.error('Error saving local data:', error);
      return {
        attempted: true,
        saved: false,
        error,
      };
    }
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
