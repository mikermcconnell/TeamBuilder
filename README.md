# TeamBuilder

TeamBuilder is a React, TypeScript, Vite app for building and comparing balanced sports team scenarios from CSV rosters.

Live app: https://teambuilder-mu.vercel.app

## Current workflow

1. **Data Source** - upload or paste a roster CSV.
2. **League Config** - set team count, team size, gender minimums, and grouping limits.
3. **Player Roster** - review warnings, edit players, set exec ratings, handlers, labels, ages, and groups.
4. **Team Scenarios** - create manual scenarios, compare versions, edit in the full-screen workspace, and export reports.

## Current features

- CSV import for legacy roster files and registration exports.
- Fuzzy and optional AI-assisted name matching for teammate and avoid requests.
- Auto-created mutual request groups, plus manual group editing.
- Configurable team count, max team size, gender requirements, and even-team enforcement.
- Manual team scenarios with drag-and-drop editing.
- Scenario version management: duplicate, delete, rename, notes, preferred marker, and final marker.
- Big Board view for dense, read-only review of every team.
- Team branding with names and colors.
- CSV exports, report exports, print/PDF support, and project backup import/export.
- Firebase sign-in, cloud project saving, local fallback, revision checks, and active-editor conflict handling.

## Tech stack

- React 18, TypeScript, Vite
- Tailwind CSS and shadcn/Radix UI components
- Firebase Auth, Firestore, and Storage rules
- Vercel serverless API routes for AI helpers
- Vitest and Testing Library
- pnpm package manager

## Local development

```bash
pnpm install
pnpm dev
```

Use Vercel dev when testing serverless AI routes locally:

```bash
pnpm dev:vercel
```

## Environment variables

Client-side Firebase settings:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=... # optional
```

AI routes:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4 # optional override
```

Optional Gemma-compatible provider for name matching, group suggestions, and team suggestions:

```env
AI_PROVIDER=gemma
GEMMA_BASE_URL=http://127.0.0.1:11434
GEMMA_MODEL=gemma4
```

Firebase Admin / automation:

```env
FIREBASE_PROJECT_ID=teambuilder-3b79e
FIREBASE_SERVICE_ACCOUNT_PATH=C:/secure/team-builder-service-account.json
# or FIREBASE_SERVICE_ACCOUNT_JSON={...}
```

## Common commands

```bash
pnpm lint
pnpm test:run
pnpm test:rules
pnpm build
pnpm verify
```

Firebase helpers:

```bash
pnpm firebase:whoami
pnpm firebase:project
pnpm firebase:deploy:rules
pnpm firebase:deploy:indexes
pnpm firebase:deploy:hosting
```

## CSV format

Recommended legacy CSV headers:

```csv
Name,Gender,Skill Rating,Exec Skill Rating,Teammate Requests,Avoid Requests,Email,Registration Notes,Age
Alice Johnson,F,8,7.5,Bob Smith,,alice@example.com,Prefers early games,29
Bob Smith,M,7,7,Alice Johnson,Charlie Brown,bob@example.com,,31
```

Notes:

- `Name` is required.
- `Gender` accepts `M`, `F`, or `Other`; missing values default to `Other`.
- `Skill Rating` and `Exec Skill Rating` use a 0-10 scale. Empty exec ratings mean N/A.
- Registration exports with first/last name, status, request, skill component, exec, age, and notes columns are also supported.

## AI routes

Vercel routes are in `api/ai`:

- `/api/ai/name-match` - helps resolve roster request names.
- `/api/ai/group-suggestions` - service endpoint for suggested groups.
- `/api/ai/team-suggestions` - service endpoint for natural-language team adjustment suggestions.
- `/api/ai/team-draft` - full draft endpoint with built-in validation and fallback support.

The current main UI creates manual scenarios first. Some AI services exist for supported helpers and future/automation workflows rather than all being exposed as primary buttons.

## Workspace automation

Build generated drafts for an existing saved workspace:

```bash
pnpm workspace:build -- --workspace-id <id> --target-teams 10 --draft-count 3 --write
```

Create a project backup, and optionally publish it to Firestore, from a roster CSV plus generated team CSV:

```bash
pnpm workspace:publish -- \
  --roster "Rosters/Spring Outdoor 2026_event-registrations_2026-04-14_11_23.csv" \
  --teams "Rosters/Spring Outdoor 2026_generated_teams.csv" \
  --project-name "Spring Outdoor 2026 AI Draft"
```

Add `--publish firestore --user-email you@example.com` to publish directly.

## Documentation map

- `AGENTS.md` - agent/developer read order and source-of-truth rules.
- `context.md` - current architecture and implementation notes.
- `FIREBASE_SETUP.md` - Firebase setup and data model.
- `FIREBASE_TEST_SUMMARY.md` and `src/tests/manual-firebase-tests.md` - persistence testing notes.
- `TEAM_DRAFT_PRIORITIES.md` - current draft-priority preferences for this workspace.
- Historical implementation notes are labelled as archived and should not override current code.
