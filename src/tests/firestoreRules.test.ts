import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'team-builder-rules-test';
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

let testEnv: RulesTestEnvironment;

describe('firestore security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it.each([
    'rosters',
    'teams',
    'sessions',
    'workspaces',
  ])('allows an owner to create their own %s document', async (collectionName) => {
    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertSucceeds(
      setDoc(doc(db, collectionName, 'doc-1'), {
        userId: 'owner-1',
        name: 'Owned document',
      })
    );
  });

  it.each([
    'rosters',
    'teams',
    'sessions',
    'workspaces',
  ])('blocks creating a %s document when the claimed owner does not match the signed-in user', async (collectionName) => {
    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(
      setDoc(doc(db, collectionName, 'doc-1'), {
        userId: 'someone-else',
        name: 'Spoofed owner',
      })
    );
  });

  it('allows a workspace owner to read their own document', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'workspaces', 'workspace-1'), {
        userId: 'owner-1',
        name: 'Owner workspace',
      });
    });

    const db = testEnv.authenticatedContext('owner-1').firestore();
    const snapshot = await assertSucceeds(getDoc(doc(db, 'workspaces', 'workspace-1')));

    expect(snapshot.data()).toEqual(
      expect.objectContaining({
        userId: 'owner-1',
        name: 'Owner workspace',
      })
    );
  });

  it('blocks reading another user’s workspace document', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'workspaces', 'workspace-1'), {
        userId: 'owner-1',
        name: 'Private workspace',
      });
    });

    const db = testEnv.authenticatedContext('intruder').firestore();

    await assertFails(getDoc(doc(db, 'workspaces', 'workspace-1')));
  });
});
