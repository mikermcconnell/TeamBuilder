import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

let firebaseCliAdcPathPromise: Promise<string> | undefined;

function normalizePrivateKey(serviceAccount: ServiceAccount): ServiceAccount {
  return {
    ...serviceAccount,
    privateKey: serviceAccount.privateKey?.replace(/\\n/g, '\n'),
  };
}

function isLocalDevelopment(): boolean {
  return !process.env.VERCEL && process.env.NODE_ENV !== 'production';
}

async function getProjectId(): Promise<string> {
  const projectId = process.env.FIREBASE_PROJECT_ID
    ?? process.env.VITE_FIREBASE_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT;

  if (projectId) {
    return projectId;
  }

  if (isLocalDevelopment()) {
    try {
      const firebaseRc = JSON.parse(
        await fs.readFile(path.resolve(process.cwd(), '.firebaserc'), 'utf8'),
      ) as { projects?: { default?: string } };
      const localProjectId = firebaseRc.projects?.default?.trim();

      if (localProjectId) {
        return localProjectId;
      }
    } catch {
      // Fall through to the actionable configuration error below.
    }
  }

  throw new Error('Missing Firebase project ID for sub lottery. Set FIREBASE_PROJECT_ID or configure .firebaserc.');
}

function getFirebaseCliConfigPaths(): string[] {
  return [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA ?? '', 'configstore', 'firebase-tools.json'),
    path.join(process.env.LOCALAPPDATA ?? '', 'configstore', 'firebase-tools.json'),
  ].filter(Boolean);
}

async function getFirebaseCliRefreshToken(): Promise<string | null> {
  for (const candidatePath of getFirebaseCliConfigPaths()) {
    try {
      const rawConfig = await fs.readFile(candidatePath, 'utf8');
      const parsedConfig = JSON.parse(rawConfig) as { tokens?: { refresh_token?: string } };
      const refreshToken = parsedConfig.tokens?.refresh_token?.trim();

      if (refreshToken) {
        return refreshToken;
      }
    } catch {
      // Try the next platform-specific Firebase CLI config path.
    }
  }

  return null;
}

async function configureFirebaseCliApplicationDefault(): Promise<string> {
  if (!firebaseCliAdcPathPromise) {
    firebaseCliAdcPathPromise = (async () => {
      const refreshToken = await getFirebaseCliRefreshToken();

      if (!refreshToken) {
        throw new Error('Firebase CLI credentials were not found. Run "pnpm firebase:whoami" or "firebase login" first.');
      }

      const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'teambuilder-firebase-adc-'));
      const credentialPath = path.join(tempDirectory, 'application-default-credentials.json');
      await fs.writeFile(credentialPath, JSON.stringify({
        client_id: process.env.FIREBASE_CLIENT_ID ?? FIREBASE_CLI_CLIENT_ID,
        client_secret: process.env.FIREBASE_CLIENT_SECRET ?? FIREBASE_CLI_CLIENT_SECRET,
        refresh_token: refreshToken,
        type: 'authorized_user',
      }), { encoding: 'utf8', mode: 0o600 });

      process.once('exit', () => {
        try {
          fsSync.unlinkSync(credentialPath);
          fsSync.rmdirSync(tempDirectory);
        } catch {
          // Best-effort cleanup; the OS temp directory is the recovery boundary.
        }
      });

      return credentialPath;
    })();
  }

  return firebaseCliAdcPathPromise;
}

async function getCredential() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ?? process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return cert(normalizePrivateKey(JSON.parse(inlineJson) as ServiceAccount));
  }

  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ?? process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64Json) {
    return cert(normalizePrivateKey(JSON.parse(Buffer.from(base64Json, 'base64').toString('utf8')) as ServiceAccount));
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ?? process.env.TEAMBUILDER_FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const fileContents = await fs.readFile(path.resolve(process.cwd(), serviceAccountPath), 'utf8');
    return cert(normalizePrivateKey(JSON.parse(fileContents) as ServiceAccount));
  }

  if (isLocalDevelopment() && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = await configureFirebaseCliApplicationDefault();
  }

  return applicationDefault();
}

export async function getSubLotteryFirestore() {
  const app = getApps().length > 0
    ? getApp()
    : initializeApp({ projectId: await getProjectId(), credential: await getCredential() });

  return getFirestore(app);
}
