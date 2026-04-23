# Team Draft Versions and Big Board Design

Date: 2026-04-23

## Goal

Make team-building easier when there are many draft versions, lots of manual edits, and a need to review all teams at once on a large screen.

This design focuses on two practical improvements:

1. Stronger draft/version management.
2. A Big Board view for seeing every team in one dense screen.

## Current context

TeamBuilder already has:

- Team iteration tabs.
- Copy and delete actions for iterations.
- Manual iteration creation.
- Rename support in the full-screen builder.
- A side-by-side iteration comparison panel.
- A full-screen team board with drag-and-drop editing.
- A responsive team grid that currently tops out around five columns on very large screens.

The new work should build on these patterns instead of replacing them.

## Proposed approach

Use an incremental design:

1. Improve the existing iteration system so each draft is easier to manage and compare.
2. Add a dedicated Big Board mode inside the current full-screen builder.
3. Keep editing and reviewing modes separate so the normal workspace does not become cluttered.

This gives immediate value without changing the team-generation algorithm.

## Feature 1: Better draft/version management

### User experience

Each draft tab should support:

- Clear display name.
- Rename.
- Duplicate.
- Delete.
- Optional short note.
- Preferred/final marker.

The active draft should remain editable. Duplicating a draft creates a safe copy before experimenting.

Suggested labels:

- `Draft 1`
- `Handler balance pass`
- `Mike edits`
- `Final candidate`

### Draft metadata

Add lightweight metadata to team iterations:

- `note`: optional text.
- `isPreferred`: true when the user marks a draft as the current favourite.
- `isFinal`: true when the user marks a draft as final.
- `updatedAt`: useful for sorting and showing recency.

Only one draft should be final at a time. Preferred can also be limited to one draft to keep the interface clear.

### Draft actions

Add an actions menu or expanded controls for each iteration:

- Rename draft.
- Duplicate draft.
- Add/edit note.
- Mark preferred.
- Mark final.
- Delete draft.

Deletion should keep the existing safe behavior: if the active draft is deleted, another available draft becomes active.

## Feature 2: Big Board view

### User experience

Add a button in the full-screen builder:

- `Big Board`
- or `View All Teams`

When enabled:

- Hide the player sidebar by default.
- Hide most editing controls.
- Use compact team cards.
- Use compact player rows.
- Show as many teams as possible across the screen.
- Keep the current draft name visible.
- Include an easy `Back to editing` control.

This mode is meant for reviewing, projecting, screenshotting, and group discussion.

### Layout

Big Board should use a denser responsive grid than the editing board:

- Small screens: 1-2 columns.
- Laptop: 3-4 columns.
- Large desktop/projector: 5-8 columns.

Team cards should avoid tall padding and oversized controls. Player rows should show the key review information only:

- Player name.
- Gender marker.
- Skill/exec rating.
- Handler marker when present.
- New/returning marker when present.

Drag-and-drop can be disabled in Big Board for the first version. This keeps the view stable and reduces risk.

## Feature 3: Draft overview dashboard

This can follow after the first two features.

Show all ready drafts in a table or card row with:

- Draft name.
- Status.
- Last updated.
- Note preview.
- Balance score.
- Skill spread.
- Gender balance summary.
- Handler spread.
- Request honour rate.
- Avoid conflicts.
- Preferred/final badge.

Actions:

- Open.
- Duplicate.
- Compare.
- Mark preferred.
- Mark final.
- Delete.

This turns many versions into a manageable review process.

## Architecture

### Components

Likely component additions:

- `DraftMetadataDialog`: edit draft name and note.
- `DraftStatusBadge`: shows preferred/final/status badges.
- `BigBoardView`: dense all-teams display.
- `CompactTeamCard`: read-focused team card for Big Board.
- `CompactPlayerRow`: compact player display for Big Board.
- `DraftOverviewPanel`: later dashboard for all drafts.

Likely component updates:

- `TeamIterationTabs`: show badges and expose more draft actions.
- `FullScreenTeamBuilder`: add view mode state: editing vs Big Board.
- Parent workspace state: store and update iteration metadata.

### State model

Add metadata directly to the existing `TeamIteration` type if that is where draft state already lives.

Suggested fields:

```ts
note?: string;
isPreferred?: boolean;
isFinal?: boolean;
updatedAt?: string;
```

When a draft is edited, update `updatedAt`. When a draft is marked final, clear `isFinal` from other drafts.

### Data flow

- User duplicates, renames, marks, or notes a draft from the tabs or overview.
- The full-screen builder calls existing iteration handlers plus new metadata handlers.
- Parent state updates the active workspace.
- Persistence should save the metadata with the workspace, just like existing iterations.

### Error handling

- Prevent marking failed or generating drafts as final.
- Disable duplicate/edit actions for generating drafts where needed.
- Confirm destructive deletes.
- If metadata save fails, show a toast and keep the current local state safe.
- If the Big Board has no teams, show the existing empty/generating state rather than a blank screen.

## Testing plan

### Unit and component tests

- Duplicating a draft keeps teams intact and creates a separate editable copy.
- Marking one draft final clears final status from others.
- Preferred marker behaves consistently.
- Draft notes persist in iteration state.
- Deleting the active draft selects a safe fallback.
- Big Board renders all teams and players.
- Big Board does not show editing-only controls in read mode.

### Manual checks

- Create several drafts and rename them.
- Duplicate a draft, edit the copy, and confirm the original is unchanged.
- Mark a draft final and reload the workspace.
- Open Big Board on laptop and wide screen sizes.
- Confirm normal drag-and-drop editing still works outside Big Board.

## Suggested implementation order

1. Extend the iteration type and persistence handling for metadata.
2. Add preferred/final/note actions to draft management.
3. Add Big Board mode using compact read-only components.
4. Add tests for metadata behavior and Big Board rendering.
5. Add the draft overview dashboard as a later enhancement.

## Out of scope for first implementation

- Changing the team-generation algorithm.
- Real-time collaborative editing.
- Full visual diff of player moves between drafts.
- Editable drag-and-drop directly inside Big Board.
- Automatic AI judging beyond existing comparison metrics.

## Recommendation

Build this in two passes:

1. First pass: duplicate-safe draft workflow plus Big Board view.
2. Second pass: draft overview dashboard and richer comparison tools.

This solves the immediate pain while keeping the app stable.
