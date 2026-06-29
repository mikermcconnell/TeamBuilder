# Manual Firebase Testing Guide

## Prerequisites

1. Run the app with `pnpm dev` or `pnpm dev:vercel`.
2. Configure `.env.local` with Firebase values.
3. Sign in inside the app.
4. Keep Firebase Console open for the active project.

## Test 1: Device/app snapshot save

1. Upload or create a small roster.
2. Edit one player:
   - set `Exec Skill Rating` to `8.5`
   - set handler/new-player metadata if available
3. Wait for the save badge to show saved.
4. Refresh the page.
5. Confirm the player and exec rating are still present.
6. In Firebase Console, check:

```text
users/{uid}/data/appState
```

Expected: the app state document includes players, config, groups, and latest metadata.

## Test 2: Workspace save/load

1. Click save project.
2. Enter a project name.
3. Confirm the save succeeds.
4. Create two manual team scenarios.
5. Rename one scenario, add a note, mark preferred, and mark final.
6. Open Big Board, then return to editing.
7. Refresh the browser.
8. Load the saved project.

Expected:

- roster is restored
- teams and unassigned players are restored
- scenario name/note/preferred/final metadata is restored
- Big Board shows the same teams

Check Firebase Console:

```text
workspaces/{workspaceId}
```

## Test 3: Local fallback

1. Sign out.
2. Make a small roster edit.
3. Refresh the page.

Expected: the app reloads from local storage and indicates local-only save behavior.

Signed-out localStorage key:

```text
teamBuilderState:anonymous
```

## Test 4: Conflict behavior

1. Sign in and open the same saved project in two browser tabs or devices.
2. Edit and save in the first tab.
3. Edit in the second tab.

Expected: the app warns that the project changed elsewhere or is active in another editor, then offers reload/merge/save-as-copy recovery.

## Test 5: Rules and automated checks

Run:

```bash
pnpm test:rules
pnpm test:run src/tests/firestoreRules.test.ts
pnpm test:run src/tests/workspaceService.test.ts
pnpm test:run src/tests/useAppPersistence.test.tsx
```

Expected: all pass.

## Notes

- Do not rely on old `window.firebase` console snippets; the app does not expose Firebase on `window` as a public testing API.
- Current saved-project UX is workspace-based, not the older SavedTeamsManager flow.
