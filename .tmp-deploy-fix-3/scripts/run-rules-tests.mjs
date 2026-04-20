import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const firebaseConfigPath = resolve(repoRoot, 'firebase.json');
const tempConfigPath = resolve(repoRoot, 'firebase.rules.tmp.json');

try {
  const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, 'utf8'));
  firebaseConfig.emulators = {
    ...(firebaseConfig.emulators ?? {}),
    firestore: {
      host: '127.0.0.1',
      port: 8085,
    },
  };

  writeFileSync(tempConfigPath, `${JSON.stringify(firebaseConfig, null, 2)}\n`, 'utf8');
  execSync(
    `firebase emulators:exec --config "${tempConfigPath}" --only firestore "vitest run --config vitest.rules.config.ts"`,
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );
} finally {
  try {
    unlinkSync(tempConfigPath);
  } catch {
    // ignore cleanup failures
  }
}
