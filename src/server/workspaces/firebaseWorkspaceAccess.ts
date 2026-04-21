import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import type { SavedWorkspace } from '../../types/index.js';

const execFileAsync = promisify(execFile);

interface ResolveUserIdOptions {
  userId?: string;
  userEmail?: string;
}

interface WorkspaceLookupOptions {
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  userEmail?: string;
}

export interface LoadedWorkspaceRecord {
  workspace: SavedWorkspace;
  updateTime?: string;
}

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
  createTime?: string;
}

interface FirestoreRunQueryResponse {
  document?: FirestoreDocument;
}

type FirestoreValue =
  | { nullValue: null }
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function normalizePrivateKey(serviceAccount: ServiceAccount): ServiceAccount {
  return {
    ...serviceAccount,
    privateKey: serviceAccount.privateKey?.replace(/\\n/g, '\n'),
  };
}

export async function loadLocalEnv(): Promise<void> {
  const envPath = path.resolve(process.cwd(), '.env.local');

  try {
    const envContents = await fs.readFile(envPath, 'utf8');
    envContents
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .forEach(line => {
        const separatorIndex = line.indexOf('=');
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
  } catch {
    // Optional file.
  }
}

function getFirebaseProjectId(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID
    ?? process.env.VITE_FIREBASE_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT;

  if (!projectId) {
    throw new Error('Missing Firebase project ID. Set FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.');
  }

  return projectId;
}

async function getServiceAccountCredential() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ?? process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return cert(normalizePrivateKey(JSON.parse(inlineJson) as ServiceAccount));
  }

  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ?? process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64Json) {
    const decoded = Buffer.from(base64Json, 'base64').toString('utf8');
    return cert(normalizePrivateKey(JSON.parse(decoded) as ServiceAccount));
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ?? process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
    const fileContents = await fs.readFile(resolvedPath, 'utf8');
    return cert(normalizePrivateKey(JSON.parse(fileContents) as ServiceAccount));
  }

  return null;
}

function getGoogleApplicationCredentialsPath() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return envPath ? path.resolve(process.cwd(), envPath) : null;
}

function getFirebaseCliConfigPaths() {
  return [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA ?? '', 'configstore', 'firebase-tools.json'),
    path.join(process.env.LOCALAPPDATA ?? '', 'configstore', 'firebase-tools.json'),
  ].filter(Boolean);
}

async function refreshFirebaseCliAccessToken() {
  const firebaseBinary = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';

  try {
    await execFileAsync(firebaseBinary, ['projects:list', '--json'], {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 30_000,
    });
  } catch {
    // Best effort only.
  }
}

async function getFirebaseCliAccessToken(): Promise<string | null> {
  await refreshFirebaseCliAccessToken();

  for (const candidatePath of getFirebaseCliConfigPaths()) {
    try {
      const rawConfig = await fs.readFile(candidatePath, 'utf8');
      const parsedConfig = JSON.parse(rawConfig) as { tokens?: { access_token?: string } };
      const accessToken = parsedConfig?.tokens?.access_token;

      if (typeof accessToken === 'string' && accessToken.trim()) {
        return accessToken.trim();
      }
    } catch {
      // Try the next candidate path.
    }
  }

  return null;
}

function shouldUseFirebaseCliRestFallback() {
  return !process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    && !process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_JSON
    && !process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    && !process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_BASE64
    && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    && !process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_PATH
    && !process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

async function fetchJsonWithFirebaseCliAccessToken<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getFirebaseCliAccessToken();

  if (!accessToken) {
    throw new Error('No Firebase CLI access token found. Run "npm run firebase:whoami" or "firebase login" first.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();
  const parsedResponse = responseText ? JSON.parse(responseText) as T & { error?: { message?: string } } : null;

  if (!response.ok) {
    throw new Error(parsedResponse?.error?.message ?? `Firebase API request failed with status ${response.status}`);
  }

  return parsedResponse as T;
}

function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) {
    return undefined;
  }

  if ('nullValue' in value) {
    return null;
  }

  if ('stringValue' in value) {
    return value.stringValue;
  }

  if ('booleanValue' in value) {
    return value.booleanValue;
  }

  if ('integerValue' in value) {
    return Number(value.integerValue);
  }

  if ('doubleValue' in value) {
    return value.doubleValue;
  }

  if ('timestampValue' in value) {
    return value.timestampValue;
  }

  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(inner => fromFirestoreValue(inner));
  }

  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, innerValue]) => [key, fromFirestoreValue(innerValue)])
    );
  }

  return undefined;
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(item => toFirestoreValue(item)),
      },
    };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot serialize non-finite number to Firestore: ${value}`);
    }

    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, innerValue]) => innerValue !== undefined)
            .map(([key, innerValue]) => [key, toFirestoreValue(innerValue)])
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function deserializeWorkspace(document: FirestoreDocument): LoadedWorkspaceRecord {
  const data = fromFirestoreValue({
    mapValue: {
      fields: document.fields ?? {},
    },
  }) as SavedWorkspace;

  return {
    workspace: data,
    updateTime: document.updateTime,
  };
}

function buildFirestoreDocumentName(workspaceId: string) {
  return `projects/${getFirebaseProjectId()}/databases/(default)/documents/workspaces/${workspaceId}`;
}

async function getFirebaseAdminApp(): Promise<App> {
  const existingApp = getApps().length > 0 ? getApp() : null;
  if (existingApp) {
    return existingApp;
  }

  const projectId = getFirebaseProjectId();
  const credential = await getServiceAccountCredential();
  const googleApplicationCredentialsPath = getGoogleApplicationCredentialsPath();

  if (credential) {
    return initializeApp({ projectId, credential });
  }

  if (googleApplicationCredentialsPath) {
    return initializeApp({ projectId, credential: applicationDefault() });
  }

  return initializeApp({ projectId, credential: applicationDefault() });
}

async function resolveUserIdViaFirebaseCli({ userId, userEmail }: ResolveUserIdOptions): Promise<string> {
  if (userId) {
    return userId;
  }

  if (!userEmail) {
    throw new Error('Resolving a workspace by name requires --user-id or --user-email.');
  }

  const projectId = getFirebaseProjectId();
  const response = await fetchJsonWithFirebaseCliAccessToken<{ users?: Array<{ localId?: string }> }>(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      body: JSON.stringify({ email: [userEmail] }),
    }
  );

  const matchedUser = response.users?.[0];
  if (!matchedUser?.localId) {
    throw new Error(`No Firebase Auth user found for email ${userEmail}.`);
  }

  return matchedUser.localId;
}

export async function resolveUserId(options: ResolveUserIdOptions): Promise<string> {
  if (shouldUseFirebaseCliRestFallback()) {
    return resolveUserIdViaFirebaseCli(options);
  }

  if (options.userId) {
    return options.userId;
  }

  if (!options.userEmail) {
    throw new Error('Resolving a workspace by name requires --user-id or --user-email.');
  }

  const auth = getAuth(await getFirebaseAdminApp());
  const userRecord = await auth.getUserByEmail(options.userEmail);
  return userRecord.uid;
}

async function getWorkspaceByIdViaFirebaseCli(workspaceId: string): Promise<LoadedWorkspaceRecord | null> {
  const document = await fetchJsonWithFirebaseCliAccessToken<FirestoreDocument | { error?: { status?: string } }>(
    `https://firestore.googleapis.com/v1/${buildFirestoreDocumentName(workspaceId)}`
  ).catch((error: Error) => {
    if (error.message.includes('NOT_FOUND')) {
      return null;
    }
    throw error;
  });

  if (!document || !('name' in document)) {
    return null;
  }

  return deserializeWorkspace(document);
}

async function findWorkspaceByNameViaFirebaseCli(userId: string, workspaceName: string): Promise<LoadedWorkspaceRecord | null> {
  const response = await fetchJsonWithFirebaseCliAccessToken<FirestoreRunQueryResponse[]>(
    `https://firestore.googleapis.com/v1/projects/${getFirebaseProjectId()}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'workspaces' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'userId' },
                    op: 'EQUAL',
                    value: { stringValue: userId },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'name' },
                    op: 'EQUAL',
                    value: { stringValue: workspaceName },
                  },
                },
              ],
            },
          },
          limit: 2,
        },
      }),
    }
  );

  const documents = response
    .map(entry => entry.document)
    .filter((document): document is FirestoreDocument => Boolean(document));

  if (documents.length === 0) {
    return null;
  }

  if (documents.length > 1) {
    throw new Error(`Multiple workspaces matched "${workspaceName}" for user ${userId}. Use --workspace-id instead.`);
  }

  return deserializeWorkspace(documents[0]);
}

async function getWorkspaceByIdViaAdmin(workspaceId: string): Promise<LoadedWorkspaceRecord | null> {
  const firestore = getFirestore(await getFirebaseAdminApp());
  const snapshot = await firestore.collection('workspaces').doc(workspaceId).get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    workspace: snapshot.data() as SavedWorkspace,
    updateTime: snapshot.updateTime.toDate().toISOString(),
  };
}

async function findWorkspaceByNameViaAdmin(userId: string, workspaceName: string): Promise<LoadedWorkspaceRecord | null> {
  const firestore = getFirestore(await getFirebaseAdminApp());
  const snapshot = await firestore
    .collection('workspaces')
    .where('userId', '==', userId)
    .where('name', '==', workspaceName)
    .limit(2)
    .get();

  if (snapshot.empty) {
    return null;
  }

  if (snapshot.docs.length > 1) {
    throw new Error(`Multiple workspaces matched "${workspaceName}" for user ${userId}. Use --workspace-id instead.`);
  }

  const doc = snapshot.docs[0];
  if (!doc) {
    return null;
  }

  return {
    workspace: doc.data() as SavedWorkspace,
    updateTime: doc.updateTime.toDate().toISOString(),
  };
}

export async function resolveWorkspaceRecord(options: WorkspaceLookupOptions): Promise<LoadedWorkspaceRecord> {
  if (options.workspaceId) {
    const loaded = shouldUseFirebaseCliRestFallback()
      ? await getWorkspaceByIdViaFirebaseCli(options.workspaceId)
      : await getWorkspaceByIdViaAdmin(options.workspaceId);

    if (!loaded) {
      throw new Error(`Workspace ${options.workspaceId} was not found.`);
    }

    return loaded;
  }

  if (!options.workspaceName) {
    throw new Error('Provide --workspace-id or both --workspace-name and --user-email/--user-id.');
  }

  const userId = await resolveUserId({
    userId: options.userId,
    userEmail: options.userEmail,
  });

  const loaded = shouldUseFirebaseCliRestFallback()
    ? await findWorkspaceByNameViaFirebaseCli(userId, options.workspaceName)
    : await findWorkspaceByNameViaAdmin(userId, options.workspaceName);

  if (!loaded) {
    throw new Error(`Workspace "${options.workspaceName}" was not found for user ${userId}.`);
  }

  return loaded;
}

export async function saveWorkspaceRecord(
  workspace: SavedWorkspace,
  options: { expectedRevision: number; expectedUpdateTime?: string }
): Promise<void> {
  if (shouldUseFirebaseCliRestFallback()) {
    const currentDocument = options.expectedUpdateTime
      ? { updateTime: options.expectedUpdateTime }
      : { exists: true };

    await fetchJsonWithFirebaseCliAccessToken(
      `https://firestore.googleapis.com/v1/projects/${getFirebaseProjectId()}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: buildFirestoreDocumentName(workspace.id),
                fields: (toFirestoreValue(workspace) as { mapValue: { fields: Record<string, FirestoreValue> } }).mapValue.fields,
              },
              currentDocument,
            },
          ],
        }),
      }
    );
    return;
  }

  const firestore = getFirestore(await getFirebaseAdminApp());
  const docRef = firestore.collection('workspaces').doc(workspace.id);

  await firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) {
      throw new Error(`Workspace ${workspace.id} was not found during save.`);
    }

    const currentRevision = (snapshot.data()?.revision ?? 0) as number;
    if (currentRevision !== options.expectedRevision) {
      throw new Error(`Workspace revision changed from ${options.expectedRevision} to ${currentRevision}. Reload before writing.`);
    }

    transaction.set(docRef, workspace, { merge: true });
  });
}
