# Firebase and Persistence Test Summary

## Current focus

Firebase testing should now focus on two persistence paths:

1. **Device/app snapshot** through `dataStorageService`.
2. **Saved projects/workspaces** through `WorkspaceService`.

Older docs may mention a separate `SavedTeamsManager` workflow. That is not the current primary UI; saved projects/workspaces are the main persistence model.

## Automated test commands

```bash
pnpm test:run src/tests/firebaseIntegration.test.ts
pnpm test:run src/tests/firestoreRules.test.ts
pnpm test:run src/tests/workspaceService.test.ts
pnpm test:run src/tests/useAppPersistence.test.tsx
pnpm test:rules
```

Full verification:

```bash
pnpm verify
```

## What to verify

### 1. App snapshot persistence

- Signed-out changes save to localStorage.
- Signed-in changes save to `users/{uid}/data/appState`.
- Local fallback is preserved when cloud save fails.
- Existing local data can migrate/sync when signing in.
- Corrupt or legacy state is sanitized on load.

### 2. Workspace/project persistence

- Projects save to `workspaces/{workspaceId}`.
- Workspaces include players, groups, config, teams, unassigned players, stats, scenario iterations, league memory, pending warnings, saved configs, and exec rating history.
- Saved projects load back into the active app state.
- Delete removes the cloud copy and local fallback when possible.
- Revision conflicts are detected.
- Active-editor conflicts pause autosave and surface clear recovery options.

### 3. Exec skill ratings

- `execSkillRating` persists as a number or `null`.
- `null` means N/A and is not converted to `0`.
- Team generation and stats use exec rating when present, otherwise skill rating.
- CSV re-import preserves known exec ratings through `execRatingHistory` when applicable.

### 4. Team scenarios

- Scenario metadata persists: name, note, preferred marker, final marker, `updatedAt`.
- Only one preferred and one final ready scenario is kept.
- Duplicated scenarios clear preferred/final markers.
- Big Board can be reopened after reload.

## Manual smoke test

1. Run `pnpm dev` or `pnpm dev:vercel`.
2. Sign in.
3. Upload a roster CSV.
4. Edit a player exec rating and handler/new-player metadata.
5. Save as a named project.
6. Create manual scenarios.
7. Rename a scenario, add a note, mark preferred/final, duplicate it, and open Big Board.
8. Refresh the page and load the saved project.
9. Confirm roster edits, teams, scenario metadata, and Big Board data are intact.
10. Check Firebase Console:
    - `users/{uid}/data/appState`
    - `workspaces/{workspaceId}`

## Expected Firestore structure

```text
users/{uid}/data/appState
workspaces/{workspaceId}
```

Legacy collections such as `rosters`, `teams`, and `savedRosters` still have rules and services in the repo, but current project save/load UX is workspace-based.

## Success criteria

- Rules tests pass.
- Workspace service tests pass.
- App persistence tests pass.
- Manual smoke test survives refresh and reload.
- No cloud save silently loses data; local fallback or conflict UI appears when needed.
