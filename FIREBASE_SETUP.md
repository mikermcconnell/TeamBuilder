# Firebase Setup Guide for TeamBuilder

## Current repo status

This repo is wired for Firebase Auth, Firestore, Storage rules, and Firebase Hosting.

Known project used by this repo:

```text
teambuilder-3b79e
```

Check your local Firebase CLI state from the repo root:

```bash
pnpm firebase:whoami
pnpm firebase:project
```

## Required Firebase products

Enable these in Firebase Console:

1. **Authentication**
   - Enable the sign-in methods used by the app. Anonymous auth is supported by the codebase; email/password may also be used if enabled.
2. **Firestore Database**
   - Use the checked-in rules in `firestore.rules`.
3. **Cloud Storage**
   - Use the checked-in rules in `storage.rules` if storage features are used.
4. **Hosting**
   - Optional; Vercel is also configured and currently used for the live app.

## App environment variables

Create `.env.local` in the repo root:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

Restart the dev server after changing `.env.local`.

## Automation credentials

Workspace publish/build scripts can use Firebase Admin credentials or a local Firebase CLI login.

Recommended for repeatable automation:

```env
FIREBASE_PROJECT_ID=teambuilder-3b79e
FIREBASE_SERVICE_ACCOUNT_PATH=C:/secure/team-builder-service-account.json
```

Alternative:

```env
FIREBASE_PROJECT_ID=teambuilder-3b79e
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

If Admin credentials are not set, some scripts can fall back to the local Firebase CLI login.

## Data model

### Device/app snapshot

Used by `src/services/dataStorageService.ts`.

```text
users/{uid}/data/appState
```

Contains the current app snapshot: players, teams, unassigned players, groups, config, scenario iterations, league memory, pending warnings, saved configs, exec rating history, and timestamps.

Signed-out users use localStorage only:

```text
teamBuilderState:anonymous
```

Signed-in users also keep a local fallback:

```text
teamBuilderState:user:<uid>
```

### Saved projects/workspaces

Used by `src/services/workspaceService.ts`.

```text
workspaces/{workspaceId}
```

Each workspace stores a full project snapshot plus metadata:

- `userId`
- `name`, `description`
- `players`, `playerGroups`, `config`
- `teams`, `unassignedPlayers`, `stats`
- `teamIterations`, `activeTeamIterationId`
- `leagueMemory`, `pendingWarnings`, `savedConfigs`, `execRatingHistory`
- `revision`
- active-editor/session fields for conflict handling

Local fallback key prefix:

```text
local_saved_workspaces:<uid>
```

## Deploy rules and hosting

```bash
pnpm firebase:deploy:rules
pnpm firebase:deploy:indexes
pnpm firebase:deploy:hosting
```

`firebase.json` points Hosting to `dist` and rewrites SPA routes to `index.html`.

## Security rules

Current Firestore rules allow users to read/write only documents they own for these collections:

- `users/{uid}/data/{document}`
- `workspaces`
- `rosters`
- `rosterVersions`
- `savedRosters`
- `teams`
- `sessions`
- `configPresets`

`rosterTemplates` can be read publicly, but only the creator can create/update/delete.

Storage rules allow signed-in owners under:

- `csvs/{userId}/...`
- `configs/{userId}/...`
- `rosters/{userId}/...`

Everything else is denied.

## Local test commands

```bash
pnpm test:rules
pnpm test:run src/tests/workspaceService.test.ts
pnpm test:run src/tests/firestoreRules.test.ts
```

## Troubleshooting

- **Firebase not configured**: confirm `.env.local`, then restart `pnpm dev`.
- **Permission denied**: confirm Auth sign-in, deployed rules, and matching `userId` fields.
- **Project save conflict**: the workspace is newer in Firestore or active elsewhere. Use reload, merge, or save as copy in the app.
- **Local-only save while signed in**: cloud save failed but local fallback succeeded. Check network, rules, and browser extensions.
