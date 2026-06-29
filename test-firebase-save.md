# Firebase Save/Load Checklist

This checklist reflects the current workspace-based save/load flow.

## Setup

- [ ] `.env.local` contains Firebase client variables.
- [ ] Firebase Auth is enabled.
- [ ] Firestore rules from `firestore.rules` are deployed or tested locally.
- [ ] App is running with `pnpm dev` or `pnpm dev:vercel`.

## App snapshot

- [ ] Sign out.
- [ ] Upload or create a roster.
- [ ] Refresh and confirm local data remains.
- [ ] Sign in.
- [ ] Confirm app data syncs to `users/{uid}/data/appState`.

## Workspace project save

- [ ] Sign in.
- [ ] Upload a CSV roster.
- [ ] Edit player metadata, including exec rating.
- [ ] Save as a named project.
- [ ] Confirm a document exists in `workspaces` with the signed-in `userId`.

## Team scenario persistence

- [ ] Create manual team scenarios.
- [ ] Move players between teams.
- [ ] Rename a scenario and add a note.
- [ ] Mark one scenario preferred.
- [ ] Mark one scenario final.
- [ ] Duplicate a scenario and confirm preferred/final markers are cleared on the copy.
- [ ] Save the project.
- [ ] Refresh and reload the project.
- [ ] Confirm teams and scenario metadata are restored.

## Big Board and export

- [ ] Open the full-screen team workspace.
- [ ] Switch to Big Board.
- [ ] Confirm all teams render in compact read-only cards.
- [ ] Return to editing.
- [ ] Export CSV/report outputs from the Team Scenarios export screen.

## Conflict handling

- [ ] Open the same project in two tabs.
- [ ] Save an edit in tab A.
- [ ] Make a conflicting edit in tab B.
- [ ] Confirm the app offers reload, merge, or save-as-copy recovery.

## Collections to check

```text
users/{uid}/data/appState
workspaces/{workspaceId}
```

The older `rosters`, `teams`, and `savedRosters` collections still have rules/services, but workspaces are the current primary save/load model.
