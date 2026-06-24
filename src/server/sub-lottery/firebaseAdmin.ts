import fs from 'node:fs/promises';
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

function normalizePrivateKey(serviceAccount: ServiceAccount): ServiceAccount {
  return {
    ...serviceAccount,
    privateKey: serviceAccount.privateKey?.replace(/\\n/g, '\n'),
  };
}

function getProjectId(): string {
  const projectId = process.env.FIREBASE_PROJECT_ID
    ?? process.env.VITE_FIREBASE_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT;

  if (!projectId) {
    throw new Error('Missing Firebase project ID for sub lottery.');
  }

  return projectId;
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

  return applicationDefault();
}

export async function getSubLotteryFirestore() {
  const app = getApps().length > 0
    ? getApp()
    : initializeApp({ projectId: getProjectId(), credential: await getCredential() });

  return getFirestore(app);
}
