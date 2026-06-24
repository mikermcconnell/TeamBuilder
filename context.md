# TeamBuilder Context and Architecture

This is the current high-level source of truth for developers and agents working in this repo. Prefer current code over older reports or dated handoff files when there is a conflict.

## Read order

1. `AGENTS.md`
2. `README.md`
3. `context.md`
4. Current source files under `src/`, `api/`, `scripts/`, and Firebase/Vercel config
5. Historical docs only when investigating old decisions

Do not treat `.tmp-deploy-fix*`, backup files, or dated handoff/report files as current implementation sources.

## Product overview

TeamBuilder helps league organizers turn rosters into editable team scenarios. The app now focuses on project-based workflow: upload roster, review roster quality, create manual scenarios, edit teams in a full-screen workspace, compare versions, use Big Board for review, then export or save the project.

Live app: https://teambuilder-mu.vercel.app

## Tech stack

- Frontend: React 18, TypeScript, Vite
- UI: Tailwind CSS, shadcn/Radix UI components, lucide-react
- State: React hooks and context, localStorage, Firestore
- Auth/persistence: Firebase Auth and Firestore
- Serverless API: Vercel functions in `api/ai`
- AI: OpenAI by default, optional Gemma-compatible provider for selected helper endpoints
- Tests: Vitest, Testing Library, Firebase rules tests
- Package manager: pnpm

## Main source layout

```text
src/
  App.tsx                         main workflow and top-level state wiring
  components/                     app UI
    ai/                           AI helper UI pieces
    roster/                       roster filters, table, and warning UI
    teams/                        Big Board and compact scenario review UI
    ui/                           reusable shadcn/Radix primitives
  contexts/                       AuthContext and WorkspaceContext
  hooks/                          persistence and TeamBuilder action hooks
  services/                       Firebase, AI, storage, roster, team, workspace services
    persistence/                  local/cloud save helpers and sanitizers
  server/ai/                      AI guards, provider routing, draft orchestration
  server/workspaces/              workspace automation helpers
  shared/                         AI contracts and mappers shared by client/server
  types/                          AppState, Player, Team, TeamIteration, workspace types
  utils/                          CSV parsing, team generation, grouping, exports, validation
  tests/                          Vitest and manual test documentation
api/ai/                           Vercel AI endpoints
scripts/                          workspace build/publish and rules test scripts
```

## Current app workflow

### Data Source

`CSVUploader` parses legacy roster CSVs and registration exports. It validates rows, detects mutual requests, can use AI name matching for unresolved request names, and sends structured warnings to the roster tab.

### League Config

`ConfigurationPanel` edits league rules. `normalizeLeagueConfig` and config helpers enforce consistent team-count behavior, max team sizes, gender minimums, and grouping limits.

### Player Roster

`PlayerRoster` supports player edits, manual additions/removals, exec rating updates, warning resolution, handler/new-player metadata, labels, registration notes, and groups. Exec rating overrides skill rating when present.

### Team Scenarios

The current primary UI creates two manual scenarios first. Users can add, copy, delete, rename, note, mark preferred, and mark final scenarios. Scenario state lives in `teamIterations`, with `activeTeamIterationId` controlling the currently applied scenario.

`FullScreenTeamBuilder` is the main editing surface. It supports drag-and-drop, undo/redo, team branding, adding/removing teams, workspace loading, draft details, preferred/final markers, and Big Board mode.

`BigBoardView` is read-only and optimized for reviewing all teams at once.

## Core state model

Important types are in `src/types/index.ts`:

- `Player` includes skill, optional exec skill, requests, labels, handler flag, new-player flag, email, age, and registration profile notes.
- `Team` includes players, average skill, gender breakdown, branding, handler count, and editable naming metadata.
- `TeamIteration` stores scenario versions, status, generation source, optional AI metadata, note, preferred/final markers, timestamps, teams, unassigned players, and stats.
- `SavedWorkspace` stores the full project snapshot plus revision and active-editor metadata.

## Persistence model

There are two related persistence layers:

1. **Device/app snapshot** via `dataStorageService`
   - localStorage key for signed-out users: `teamBuilderState:anonymous`
   - localStorage key for signed-in users: `teamBuilderState:user:<uid>`
   - Firestore path: `users/{uid}/data/appState`

2. **Saved projects/workspaces** via `WorkspaceService`
   - Firestore collection: `workspaces`
   - local fallback key prefix: `local_saved_workspaces:<uid>`
   - revision numbers and active-editor heartbeats are used for conflict detection.

Workspace saves include roster, config, teams, unassigned players, team iterations, league memory, pending warnings, saved configs, and exec rating history.

## AI model and endpoints

AI calls go through `src/services/aiClient.ts` to Vercel endpoints in `api/ai`.

- `name-match` is used by CSV upload name refinement.
- `group-suggestions` and `team-suggestions` have service/provider support but are not the primary main-screen workflow.
- `team-draft` supports full-team draft generation with validation and fallback logic; current visible scenario creation is manual-first.

`src/server/ai/provider.ts` chooses OpenAI by default or Gemma when `AI_PROVIDER=gemma`. Gemma applies to name matching, group suggestions, and team suggestions. Full team draft generation still uses the OpenAI draft orchestrator/fallback path.

## Testing and verification

Use these before claiming code or documentation is current:

```bash
pnpm lint
pnpm test:run
pnpm test:rules
pnpm build
```

`pnpm verify` runs lint, tests, rules tests, and build.

Focused tests exist for workspace persistence, team iterations, Big Board, AI providers/client, CSV parsing, Firebase rules, and roster/team utilities.

## Current documentation boundaries

- `README.md`, `context.md`, `FIREBASE_SETUP.md`, and `TEAM_DRAFT_PRIORITIES.md` are durable docs.
- `docs/superpowers/*` files are historical design/implementation notes unless explicitly updated.
- `PROJECT_REPORT.md`, `TUTORIAL_GUIDE.md`, `TEAMBUILDER_SESSION_HANDOFF_2026-04-10.md`, and test-result reports are archived context and should not override current source.
