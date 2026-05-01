import { db } from '@/config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    deleteDoc,
    runTransaction,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    type Unsubscribe
} from 'firebase/firestore';
import { SavedWorkspace } from '@/types';
import { cleanUndefinedDeep } from './persistence/cleanup';
import { buildLocalStorageKey, readFirstLocalStorageValue } from './persistence/localKeys';
import type { SaveTargetResult, WorkspaceSaveResult } from './persistence/saveTypes';
import { sanitizeWorkspaceForLocalCache } from './persistence/localCacheSanitizer';

export class WorkspaceService {
    private static readonly COLLECTION = 'workspaces';
    private static readonly LEGACY_LOCAL_KEY = 'local_saved_workspaces';
    private static readonly LOCAL_KEY_PREFIX = 'local_saved_workspaces';
    private static readonly ACTIVE_EDITOR_TIMEOUT_MS = 2 * 60 * 1000;
    private static clientSessionId: string | null = null;

    private static getClientSessionId(): string {
        if (!this.clientSessionId) {
            const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2);
            this.clientSessionId = `session-${randomPart}`;
        }

        return this.clientSessionId;
    }

    static getCurrentSessionId(): string {
        return this.getClientSessionId();
    }

    private static getDeviceLabel(): string {
        if (typeof navigator === 'undefined') {
            return 'server';
        }

        return navigator.userAgent.slice(0, 120);
    }

    private static getLocalKey(userId: string): string {
        return buildLocalStorageKey(this.LOCAL_KEY_PREFIX, userId);
    }

    private static readLocalWorkspaces(userId: string): SavedWorkspace[] {
        try {
            const existingStr = readFirstLocalStorageValue([
                this.getLocalKey(userId),
                this.LEGACY_LOCAL_KEY,
            ]);
            const parsed = existingStr ? JSON.parse(existingStr) as SavedWorkspace[] : [];
            return parsed
                .filter(workspace => workspace.userId === userId)
                .map(workspace => this.normalizeWorkspace(workspace));
        } catch (error) {
            console.warn('Failed to read local workspaces:', error);
            return [];
        }
    }

    private static writeLocalWorkspaces(userId: string, workspaces: SavedWorkspace[]): void {
        localStorage.setItem(
            this.getLocalKey(userId),
            JSON.stringify(workspaces.map(workspace => sanitizeWorkspaceForLocalCache(workspace)))
        );
    }

    private static getWorkspaceTimestamp(workspace?: SavedWorkspace | null): number {
        const timestampSource = workspace?.updatedAtServer || workspace?.updatedAt;
        if (!timestampSource) {
            return 0;
        }

        const timestamp = new Date(timestampSource).getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    private static toIsoString(value: unknown): string | undefined {
        if (value instanceof Timestamp) {
            return value.toDate().toISOString();
        }

        if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
            return (value as { toDate: () => Date }).toDate().toISOString();
        }

        return typeof value === 'string' && value ? value : undefined;
    }

    private static preferNewerWorkspace(first?: SavedWorkspace | null, second?: SavedWorkspace | null): SavedWorkspace | null {
        if (!first) return second ?? null;
        if (!second) return first;
        return this.getWorkspaceTimestamp(second) > this.getWorkspaceTimestamp(first) ? second : first;
    }

    private static normalizeWorkspace(workspace: SavedWorkspace): SavedWorkspace {
        return {
            ...workspace,
            execRatingHistory: workspace.execRatingHistory || {},
            savedConfigs: workspace.savedConfigs || [],
            teamIterations: workspace.teamIterations || [],
            activeTeamIterationId: workspace.activeTeamIterationId ?? null,
            leagueMemory: workspace.leagueMemory || [],
            pendingWarnings: workspace.pendingWarnings || [],
            revision: workspace.revision ?? 0,
            createdAtServer: this.toIsoString(workspace.createdAtServer),
            updatedAtServer: this.toIsoString(workspace.updatedAtServer),
            lastEditedAt: this.toIsoString(workspace.lastEditedAt) ?? workspace.lastEditedAt,
            activeSessionHeartbeatAt: this.toIsoString(workspace.activeSessionHeartbeatAt) ?? workspace.activeSessionHeartbeatAt,
            activeEditors: Object.fromEntries(
                Object.entries(workspace.activeEditors ?? {}).map(([sessionId, presence]) => [
                    sessionId,
                    {
                        ...presence,
                        sessionId: presence.sessionId || sessionId,
                        heartbeatAt: this.toIsoString(presence.heartbeatAt) ?? presence.heartbeatAt,
                    },
                ])
            ),
        };
    }

    private static getActiveEditors(workspace: SavedWorkspace | null, now: string): Array<{ sessionId: string; heartbeatAt: string; deviceLabel?: string }> {
        if (!workspace) {
            return [];
        }

        const nowTime = new Date(now).getTime();
        const activeEditors = Object.entries(workspace.activeEditors ?? {})
            .map(([sessionId, presence]) => ({
                sessionId: presence.sessionId || sessionId,
                heartbeatAt: presence.heartbeatAt,
                deviceLabel: presence.deviceLabel,
            }))
            .filter(presence => {
                const heartbeatTime = presence.heartbeatAt ? new Date(presence.heartbeatAt).getTime() : 0;
                return !Number.isNaN(heartbeatTime) &&
                    !Number.isNaN(nowTime) &&
                    nowTime - heartbeatTime < this.ACTIVE_EDITOR_TIMEOUT_MS;
            });

        if (workspace.activeSessionId && workspace.activeSessionHeartbeatAt) {
            const heartbeatTime = new Date(workspace.activeSessionHeartbeatAt).getTime();
            const alreadyIncluded = activeEditors.some(editor => editor.sessionId === workspace.activeSessionId);

            if (!alreadyIncluded && !Number.isNaN(heartbeatTime) && !Number.isNaN(nowTime) && nowTime - heartbeatTime < this.ACTIVE_EDITOR_TIMEOUT_MS) {
                activeEditors.push({
                    sessionId: workspace.activeSessionId,
                    heartbeatAt: workspace.activeSessionHeartbeatAt,
                    deviceLabel: workspace.lastEditedByDevice,
                });
            }
        }

        return activeEditors;
    }

    private static getActiveEditorElsewhere(workspace: SavedWorkspace | null, sessionId: string, now: string) {
        return this.getActiveEditors(workspace, now).find(editor => editor.sessionId !== sessionId) ?? null;
    }

    private static isActiveElsewhere(workspace: SavedWorkspace | null, sessionId: string, now: string): boolean {
        return Boolean(this.getActiveEditorElsewhere(workspace, sessionId, now));
    }

    static getActiveEditorConflict(workspace: SavedWorkspace): WorkspaceSaveResult['conflict'] | null {
        const now = new Date().toISOString();
        const activeEditor = this.getActiveEditorElsewhere(workspace, this.getClientSessionId(), now);

        if (!activeEditor) {
            return null;
        }

        return {
            expectedRevision: workspace.revision,
            actualRevision: workspace.revision,
            reason: 'active-editor',
            lastEditedBySession: workspace.lastEditedBySession,
            activeSessionId: activeEditor.sessionId,
            activeSessionHeartbeatAt: activeEditor.heartbeatAt,
        };
    }

    private static buildActiveEditors(workspace: SavedWorkspace | null, sessionId: string, now: string): SavedWorkspace['activeEditors'] {
        const activeEditors = Object.fromEntries(
            this.getActiveEditors(workspace, now).map(editor => [
                editor.sessionId,
                {
                    sessionId: editor.sessionId,
                    deviceLabel: editor.deviceLabel,
                    heartbeatAt: editor.heartbeatAt,
                },
            ])
        );

        activeEditors[sessionId] = {
            sessionId,
            deviceLabel: this.getDeviceLabel(),
            heartbeatAt: now,
        };

        return activeEditors;
    }

    private static buildConflictResult(
        workspaceId: string,
        expectedRevision: number | undefined,
        existingWorkspace: SavedWorkspace | null,
        reason: 'revision' | 'active-editor'
    ): WorkspaceSaveResult {
        return {
            id: workspaceId,
            type: 'conflict',
            revision: existingWorkspace?.revision ?? 0,
            conflict: {
                expectedRevision,
                actualRevision: existingWorkspace?.revision ?? 0,
                reason,
                lastEditedBySession: existingWorkspace?.lastEditedBySession,
                activeSessionId: existingWorkspace?.activeSessionId,
                activeSessionHeartbeatAt: existingWorkspace?.activeSessionHeartbeatAt,
            },
            local: {
                attempted: false,
                saved: false,
            },
            cloud: {
                attempted: false,
                saved: false,
            },
            error: new Error(reason === 'active-editor'
                ? 'Workspace is active in another editor'
                : 'Workspace save conflict detected'),
        };
    }

    private static upsertLocalWorkspace(workspace: SavedWorkspace): void {
        const existing = this.readLocalWorkspaces(workspace.userId);
        const existingIndex = existing.findIndex(w => w.id === workspace.id);

        if (existingIndex >= 0) {
            existing[existingIndex] = workspace;
        } else {
            existing.push(workspace);
        }

        this.writeLocalWorkspaces(workspace.userId, existing);
    }

    /**
     * Save a workspace to Firestore. Creates new or updates existing.
     */
    static async saveWorkspace(
        workspace: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt' | 'revision'>,
        options?: {
            id?: string;
            expectedRevision?: number | null;
            force?: boolean;
        }
    ): Promise<WorkspaceSaveResult> {
        const workspaceId = options?.id || doc(collection(db, this.COLLECTION)).id;
        const now = new Date().toISOString();
        const sessionId = this.getClientSessionId();
        const existingLocalWorkspace = this.readLocalWorkspaces(workspace.userId).find(w => w.id === workspaceId) || null;

        const expectedRevision = options?.expectedRevision ?? undefined;

        if (!options?.force && expectedRevision !== undefined && existingLocalWorkspace && existingLocalWorkspace.revision > expectedRevision) {
            return this.buildConflictResult(workspaceId, expectedRevision, existingLocalWorkspace, 'revision');
        }

        const baseRevision = existingLocalWorkspace?.revision ?? 0;
        const rawPayload = {
            ...workspace,
            id: workspaceId,
            updatedAt: now,
            createdAt: existingLocalWorkspace?.createdAt || now,
            createdAtServer: existingLocalWorkspace?.createdAtServer,
            updatedAtServer: existingLocalWorkspace?.updatedAtServer,
            revision: baseRevision + 1,
            lastEditedBySession: sessionId,
            lastEditedByDevice: this.getDeviceLabel(),
            lastEditedAt: now,
            activeSessionId: sessionId,
            activeSessionHeartbeatAt: now,
        };

        const payload = this.normalizeWorkspace(cleanUndefinedDeep(rawPayload) as SavedWorkspace);

        const cloudResult = await this.trySaveCloudWorkspace(payload, expectedRevision, options?.force ?? false, sessionId, now);

        if ('type' in cloudResult && cloudResult.type === 'conflict') {
            return cloudResult;
        }

        const normalizedCloudWorkspace = cloudResult.workspace
            ? this.normalizeWorkspace(cloudResult.workspace)
            : null;

        if (cloudResult.saved) {
            const localResult = this.trySaveLocalWorkspace(normalizedCloudWorkspace ?? payload);
            return {
                id: workspaceId,
                revision: normalizedCloudWorkspace?.revision ?? payload.revision,
                type: 'cloud',
                local: localResult,
                cloud: cloudResult,
                ...(localResult.error ? { error: localResult.error } : {}),
            };
        }

        const localResult = this.trySaveLocalWorkspace(payload);
        if (localResult.saved) {
            return {
                id: workspaceId,
                revision: payload.revision,
                type: 'local',
                local: localResult,
                cloud: cloudResult,
                error: cloudResult.error,
            };
        }

        return {
            id: workspaceId,
            revision: baseRevision,
            type: 'error',
            local: localResult,
            cloud: cloudResult,
            error: cloudResult.error ?? localResult.error,
        };
    }

    private static trySaveLocalWorkspace(workspace: SavedWorkspace): SaveTargetResult {
        try {
            this.upsertLocalWorkspace(workspace);
            return {
                attempted: true,
                saved: true,
            };
        } catch (storageError) {
            return {
                attempted: true,
                saved: false,
                error: storageError instanceof DOMException &&
                    (storageError.name === 'QuotaExceededError' || storageError.code === 22)
                    ? new Error('Local storage is full. Please delete old projects or free up browser storage.')
                    : storageError,
            };
        }
    }

    private static async trySaveCloudWorkspace(
        workspace: SavedWorkspace,
        expectedRevision: number | undefined,
        force: boolean,
        sessionId: string,
        now: string
    ): Promise<(SaveTargetResult & { workspace?: SavedWorkspace }) | WorkspaceSaveResult> {
        try {
            const workspaceRef = doc(db, this.COLLECTION, workspace.id);
            const transactionWorkspace = await runTransaction(db, async transaction => {
                const existingDoc = await transaction.get(workspaceRef);
                const existingWorkspace = existingDoc.exists()
                    ? this.normalizeWorkspace(existingDoc.data() as SavedWorkspace)
                    : null;

                if (!force && expectedRevision !== undefined) {
                    const actualRevision = existingWorkspace?.revision ?? 0;

                    if (actualRevision > expectedRevision) {
                        throw this.buildConflictResult(workspace.id, expectedRevision, existingWorkspace, 'revision');
                    }

                    if (this.isActiveElsewhere(existingWorkspace, sessionId, now)) {
                        throw this.buildConflictResult(workspace.id, expectedRevision, existingWorkspace, 'active-editor');
                    }
                }

                const cloudPayload = cleanUndefinedDeep({
                    ...workspace,
                    createdAt: existingWorkspace?.createdAt || workspace.createdAt,
                    createdAtServer: existingWorkspace?.createdAtServer ?? serverTimestamp(),
                    updatedAtServer: serverTimestamp(),
                    revision: (existingWorkspace?.revision ?? 0) + 1,
                    lastEditedBySession: sessionId,
                    lastEditedByDevice: workspace.lastEditedByDevice,
                    lastEditedAt: now,
                    activeSessionId: sessionId,
                    activeSessionHeartbeatAt: now,
                    activeEditors: this.buildActiveEditors(existingWorkspace, sessionId, now),
                }) as SavedWorkspace;

                await Promise.resolve(transaction.set(workspaceRef, cloudPayload, { merge: true }));
                return this.normalizeWorkspace(cloudPayload);
            });

            const savedDoc = await getDoc(workspaceRef);
            return {
                attempted: true,
                saved: true,
                workspace: savedDoc.exists()
                    ? this.normalizeWorkspace(savedDoc.data() as SavedWorkspace)
                    : transactionWorkspace,
            };
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'type' in error && (error as WorkspaceSaveResult).type === 'conflict') {
                return error as WorkspaceSaveResult;
            }

            console.error('Error saving workspace to cloud:', {
                error,
                code: error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined,
                message: error instanceof Error ? error.message : undefined,
                userId: workspace.userId,
                workspaceId: workspace.id
            });

            return {
                attempted: true,
                saved: false,
                error,
            };
        }
    }

    static async touchWorkspacePresence(workspaceId: string, userId: string): Promise<void> {
        const sessionId = this.getClientSessionId();
        const now = new Date().toISOString();
        const workspaceRef = doc(db, this.COLLECTION, workspaceId);

        await runTransaction(db, async transaction => {
            const existingDoc = await transaction.get(workspaceRef);

            if (!existingDoc.exists()) {
                return;
            }

            const existingWorkspace = this.normalizeWorkspace(existingDoc.data() as SavedWorkspace);

            if (existingWorkspace.userId !== userId) {
                return;
            }

            const presencePayload = cleanUndefinedDeep({
                activeSessionId: sessionId,
                activeSessionHeartbeatAt: now,
                lastEditedBySession: sessionId,
                lastEditedByDevice: this.getDeviceLabel(),
                activeEditors: this.buildActiveEditors(existingWorkspace, sessionId, now),
            });

            await Promise.resolve(transaction.set(workspaceRef, presencePayload, { merge: true }));
        });
    }

    static subscribeWorkspace(
        workspaceId: string,
        userId: string,
        onWorkspace: (workspace: SavedWorkspace | null) => void,
        onError?: (error: unknown) => void
    ): Unsubscribe {
        const workspaceRef = doc(db, this.COLLECTION, workspaceId);

        return onSnapshot(
            workspaceRef,
            snapshot => {
                if (!snapshot.exists()) {
                    onWorkspace(null);
                    return;
                }

                const workspace = this.normalizeWorkspace(snapshot.data() as SavedWorkspace);

                if (workspace.userId !== userId) {
                    onWorkspace(null);
                    return;
                }

                onWorkspace(workspace);
            },
            error => {
                onError?.(error);
            }
        );
    }

    /**
     * Get all workspaces for a user.
     */
    static async getUserWorkspaces(userId: string): Promise<SavedWorkspace[]> {
        try {
            const q = query(
                collection(db, this.COLLECTION),
                where('userId', '==', userId)
            );

            let workspaces: SavedWorkspace[] = [];

            // Try fetch from cloud
            try {
                const snapshot = await getDocs(q);
                workspaces = snapshot.docs.map(doc => this.normalizeWorkspace(doc.data() as SavedWorkspace));
            } catch (cloudError) {
                console.warn('Failed to fetch cloud workspaces, showing local only:', cloudError);
            }

            // Always merge with local for resilience
            const mergedById = new Map<string, SavedWorkspace>();
            workspaces.forEach(workspace => {
                mergedById.set(workspace.id, workspace);
            });

            this.readLocalWorkspaces(userId)
                .filter(workspace => workspace.userId === userId)
                .forEach(localWorkspace => {
                    const existingWorkspace = mergedById.get(localWorkspace.id);
                    mergedById.set(
                        localWorkspace.id,
                        this.preferNewerWorkspace(existingWorkspace, localWorkspace) as SavedWorkspace
                    );
                });

            return Array.from(mergedById.values()).sort((a, b) => this.getWorkspaceTimestamp(b) - this.getWorkspaceTimestamp(a));
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            throw new Error('Failed to fetch workspaces');
        }
    }

    /**
     * Get a single workspace by ID.
     */
    static async getWorkspace(id: string, userId: string): Promise<SavedWorkspace | null> {
        const localWorkspace = this.readLocalWorkspaces(userId).find(workspace => workspace.id === id) || null;

        try {
            const docRef = doc(db, this.COLLECTION, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const cloudWorkspace = this.normalizeWorkspace(docSnap.data() as SavedWorkspace);
                return this.preferNewerWorkspace(cloudWorkspace, localWorkspace);
            }
            return localWorkspace;
        } catch (error) {
            console.error('Error getting workspace, falling back to local copy:', error);
            return localWorkspace;
        }
    }

    /**
     * Delete a workspace.
     */
    static async deleteWorkspace(id: string, userId: string): Promise<void> {
        let cloudDeleted = false;
        let localDeleted = false;

        // Try to delete from Firestore
        try {
            await deleteDoc(doc(db, this.COLLECTION, id));
            cloudDeleted = true;
        } catch (error) {
            console.warn('Failed to delete workspace from cloud:', error);
            // Continue to try local deletion
        }

        // Also delete from localStorage (in case it was saved locally)
        try {
            const existing = this.readLocalWorkspaces(userId);
            const filtered = existing.filter(w => w.id !== id);
            if (filtered.length < existing.length) {
                this.writeLocalWorkspaces(userId, filtered);
                localDeleted = true;
            }
        } catch (localError) {
            console.warn('Failed to delete workspace from local storage:', localError);
        }

        // If neither succeeded, throw an error
        if (!cloudDeleted && !localDeleted) {
            throw new Error('Failed to delete workspace');
        }
    }
}
