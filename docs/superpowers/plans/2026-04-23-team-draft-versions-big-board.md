# Team Draft Versions and Big Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safer draft version management and a dense read-only Big Board view for reviewing every team at once.

**Architecture:** Extend the existing `TeamIteration` model with lightweight metadata, keep iteration state updates centralized in `src/utils/teamIterations.ts`, then wire those actions through `App.tsx` into the full-screen builder. Add focused read-only Big Board components so the normal drag-and-drop editing board stays unchanged.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, TailwindCSS, shadcn/ui, lucide-react.

---

## Scope

This plan implements the first pass from the approved design:

- Draft metadata: note, preferred marker, final marker, updated timestamp.
- Safe metadata operations: duplicate clears preferred/final flags, only one preferred/final draft at a time.
- UI controls for draft note/preferred/final.
- Big Board read-only view.

The draft overview dashboard is excluded from this first pass because the approved design recommends it as a second pass after the immediate workflow is stable.

## File map

- Modify: `src/types/index.ts` — add optional metadata fields to `TeamIteration`.
- Modify: `src/utils/teamIterations.ts` — set `updatedAt`; add metadata helpers.
- Modify: `src/tests/teamIterations.test.ts` — cover metadata helper behavior and copy behavior.
- Modify: `src/App.tsx` — add handlers for note/preferred/final metadata.
- Modify: `src/components/TeamIterationTabs.tsx` — show badges and expose metadata actions.
- Modify: `src/tests/teamIterationTabs.test.tsx` — cover badges and metadata action callbacks.
- Modify: `src/components/FullScreenTeamBuilder.tsx` — add draft details dialog and Big Board mode.
- Create: `src/components/teams/CompactPlayerRow.tsx` — compact read-only player row.
- Create: `src/components/teams/CompactTeamCard.tsx` — compact read-only team card.
- Create: `src/components/teams/BigBoardView.tsx` — dense all-teams read-only grid.
- Create: `src/tests/BigBoardView.test.tsx` — cover Big Board rendering.
- Modify: `src/tests/fullScreenTeamBuilder.test.tsx` — cover Big Board toggle and draft details dialog.

---

### Task 1: Add draft metadata fields and utility behavior

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/teamIterations.ts`
- Modify: `src/tests/teamIterations.test.ts`

- [ ] **Step 1: Add failing metadata tests**

Update the import from `@/utils/teamIterations` in `src/tests/teamIterations.test.ts`:

```ts
import {
  createCopiedTeamIteration,
  deleteTeamIterationFromState,
  ensureTeamIterations,
  getUniqueIterationName,
  markTeamIterationFinal,
  markTeamIterationPreferred,
  updateTeamIterationMetadata,
} from '@/utils/teamIterations';
```

Append these tests inside the existing `describe('team iteration normalization', () => { ... })` block:

```ts
  it('clears preferred and final markers when copying a draft', () => {
    const sourceIteration: TeamIteration = {
      id: 'manual-1',
      name: 'Final Candidate',
      type: 'manual',
      status: 'ready',
      isPreferred: true,
      isFinal: true,
      note: 'Keep this note on the original only.',
      createdAt: '2026-04-23T10:00:00.000Z',
      updatedAt: '2026-04-23T10:05:00.000Z',
      teams: [],
      unassignedPlayers: [],
    };

    const result = createCopiedTeamIteration(sourceIteration, [sourceIteration]);

    expect(result.name).toBe('Final Candidate Copy');
    expect(result.isPreferred).toBe(false);
    expect(result.isFinal).toBe(false);
    expect(result.note).toBeUndefined();
    expect(result.updatedAt).toBe(result.createdAt);
  });

  it('updates a draft note and timestamp without changing other drafts', () => {
    const state = {
      players: [],
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: getDefaultConfig(),
      execRatingHistory: {},
      savedConfigs: [],
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-23T10:00:00.000Z',
          updatedAt: '2026-04-23T10:00:00.000Z',
          teams: [],
          unassignedPlayers: [],
        },
        {
          id: 'manual-2',
          name: 'Manual 2',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-23T10:01:00.000Z',
          updatedAt: '2026-04-23T10:01:00.000Z',
          teams: [],
          unassignedPlayers: [],
        },
      ],
      activeTeamIterationId: 'manual-1',
    } as AppState;

    const result = updateTeamIterationMetadata(state, 'manual-1', {
      note: 'Better handler balance.',
      now: '2026-04-23T11:00:00.000Z',
    });

    expect(result.teamIterations?.[0]?.note).toBe('Better handler balance.');
    expect(result.teamIterations?.[0]?.updatedAt).toBe('2026-04-23T11:00:00.000Z');
    expect(result.teamIterations?.[1]?.note).toBeUndefined();
    expect(result.teamIterations?.[1]?.updatedAt).toBe('2026-04-23T10:01:00.000Z');
  });

  it('keeps only one preferred draft', () => {
    const state = {
      players: [],
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: getDefaultConfig(),
      execRatingHistory: {},
      savedConfigs: [],
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          isPreferred: true,
          createdAt: '2026-04-23T10:00:00.000Z',
          teams: [],
          unassignedPlayers: [],
        },
        {
          id: 'manual-2',
          name: 'Manual 2',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-23T10:01:00.000Z',
          teams: [],
          unassignedPlayers: [],
        },
      ],
      activeTeamIterationId: 'manual-1',
    } as AppState;

    const result = markTeamIterationPreferred(state, 'manual-2', '2026-04-23T12:00:00.000Z');

    expect(result.teamIterations?.map(iteration => ({ id: iteration.id, isPreferred: iteration.isPreferred }))).toEqual([
      { id: 'manual-1', isPreferred: false },
      { id: 'manual-2', isPreferred: true },
    ]);
    expect(result.teamIterations?.[1]?.updatedAt).toBe('2026-04-23T12:00:00.000Z');
  });

  it('keeps only one final ready draft and ignores failed drafts', () => {
    const state = {
      players: [],
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      playerGroups: [],
      config: getDefaultConfig(),
      execRatingHistory: {},
      savedConfigs: [],
      teamIterations: [
        {
          id: 'manual-1',
          name: 'Manual 1',
          type: 'manual',
          status: 'ready',
          isFinal: true,
          createdAt: '2026-04-23T10:00:00.000Z',
          teams: [],
          unassignedPlayers: [],
        },
        {
          id: 'manual-2',
          name: 'Manual 2',
          type: 'manual',
          status: 'ready',
          createdAt: '2026-04-23T10:01:00.000Z',
          teams: [],
          unassignedPlayers: [],
        },
        {
          id: 'manual-3',
          name: 'Broken Draft',
          type: 'manual',
          status: 'failed',
          createdAt: '2026-04-23T10:02:00.000Z',
          teams: [],
          unassignedPlayers: [],
        },
      ],
      activeTeamIterationId: 'manual-1',
    } as AppState;

    const finalResult = markTeamIterationFinal(state, 'manual-2', '2026-04-23T12:30:00.000Z');
    const failedResult = markTeamIterationFinal(finalResult, 'manual-3', '2026-04-23T12:35:00.000Z');

    expect(finalResult.teamIterations?.map(iteration => ({ id: iteration.id, isFinal: iteration.isFinal }))).toEqual([
      { id: 'manual-1', isFinal: false },
      { id: 'manual-2', isFinal: true },
      { id: 'manual-3', isFinal: false },
    ]);
    expect(failedResult).toBe(finalResult);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/tests/teamIterations.test.ts
```

Expected: FAIL because the new metadata helpers and fields do not exist yet.

- [ ] **Step 3: Extend the `TeamIteration` type**

In `src/types/index.ts`, add these fields after `createdAt` in `TeamIteration`:

```ts
  updatedAt?: string;
  note?: string;
  isPreferred?: boolean;
  isFinal?: boolean;
```

- [ ] **Step 4: Add metadata helpers and timestamps**

In `src/utils/teamIterations.ts`, add this exported interface near the imports:

```ts
export interface TeamIterationMetadataUpdates {
  name?: string;
  note?: string;
  isPreferred?: boolean;
  isFinal?: boolean;
  now?: string;
}
```

In each iteration factory, set `updatedAt` to the same local timestamp as `createdAt`. Apply this pattern to `createPendingTeamIteration`, `createManualTeamIteration`, `createAutoGeneratedAiTeamIteration`, `createAiTeamIteration`, and the legacy iteration inside `ensureTeamIterations`:

```ts
const now = new Date().toISOString();

return {
  id: createIterationId(type),
  name,
  type,
  status: 'generating',
  teams: [],
  unassignedPlayers: [],
  createdAt: now,
  updatedAt: now,
};
```

Update `createCopiedTeamIteration`:

```ts
export function createCopiedTeamIteration(
  iteration: TeamIteration,
  existingIterations: TeamIteration[]
): TeamIteration {
  const clonedIteration = cloneTeamIteration(iteration);
  const existingIterationNames = existingIterations.map(existingIteration => existingIteration.name || 'Untitled Tab');
  const existingTeamNames = existingIterations.flatMap(existingIteration =>
    (existingIteration.teams ?? []).map(team => team.name)
  );
  const now = new Date().toISOString();

  return {
    ...clonedIteration,
    id: createIterationId(iteration.type),
    name: getUniqueCopiedIterationName(iteration.name, existingIterationNames),
    teams: ensureUniqueTeamNames(clonedIteration.teams, existingTeamNames, {
      preferAlternativeBranding: true,
    }),
    createdAt: now,
    updatedAt: now,
    note: undefined,
    isPreferred: false,
    isFinal: false,
    errorMessage: undefined,
  };
}
```

In `ensureTeamIterations`, add these defaults inside `normalizedIteration`:

```ts
      updatedAt: iteration.updatedAt || iteration.createdAt || new Date().toISOString(),
      note: iteration.note,
      isPreferred: Boolean(iteration.isPreferred),
      isFinal: Boolean(iteration.isFinal),
```

In `syncActiveTeamIterationToState`, set `updatedAt` on the active iteration:

```ts
  const now = new Date().toISOString();
  const updatedIterations = state.teamIterations.map(iteration => (
    iteration.id === state.activeTeamIterationId
      ? {
        ...iteration,
        teams: (state.teams ?? []).map(cloneTeam),
        unassignedPlayers: (state.unassignedPlayers ?? []).map(clonePlayer),
        stats: cloneStats(state.stats),
        updatedAt: now,
        errorMessage: undefined,
      }
      : iteration
  ));
```

Add these helpers after `deleteTeamIterationFromState`:

```ts
export function updateTeamIterationMetadata(
  state: AppState,
  iterationId: string,
  updates: TeamIterationMetadataUpdates
): AppState {
  const existingIterations = state.teamIterations ?? [];
  const hasTarget = existingIterations.some(iteration => iteration.id === iterationId);

  if (!hasTarget) {
    return state;
  }

  const now = updates.now ?? new Date().toISOString();

  return {
    ...state,
    teamIterations: existingIterations.map(iteration => {
      if (iteration.id !== iterationId) {
        return iteration;
      }

      return {
        ...iteration,
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.note !== undefined ? { note: updates.note.trim() || undefined } : {}),
        ...(updates.isPreferred !== undefined ? { isPreferred: updates.isPreferred } : {}),
        ...(updates.isFinal !== undefined ? { isFinal: updates.isFinal } : {}),
        updatedAt: now,
      };
    }),
  };
}

export function markTeamIterationPreferred(
  state: AppState,
  iterationId: string,
  now = new Date().toISOString()
): AppState {
  const existingIterations = state.teamIterations ?? [];
  const target = existingIterations.find(iteration => iteration.id === iterationId);

  if (!target || target.status !== 'ready') {
    return state;
  }

  return {
    ...state,
    teamIterations: existingIterations.map(iteration => ({
      ...iteration,
      isPreferred: iteration.id === iterationId,
      updatedAt: iteration.id === iterationId ? now : iteration.updatedAt,
    })),
  };
}

export function markTeamIterationFinal(
  state: AppState,
  iterationId: string,
  now = new Date().toISOString()
): AppState {
  const existingIterations = state.teamIterations ?? [];
  const target = existingIterations.find(iteration => iteration.id === iterationId);

  if (!target || target.status !== 'ready') {
    return state;
  }

  return {
    ...state,
    teamIterations: existingIterations.map(iteration => ({
      ...iteration,
      isFinal: iteration.id === iterationId,
      updatedAt: iteration.id === iterationId ? now : iteration.updatedAt,
    })),
  };
}
```

- [ ] **Step 5: Run metadata tests**

Run:

```bash
pnpm vitest run src/tests/teamIterations.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/types/index.ts src/utils/teamIterations.ts src/tests/teamIterations.test.ts
git commit -m "Add team draft metadata helpers"
```

---

### Task 2: Add draft metadata controls to tabs and app state

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TeamIterationTabs.tsx`
- Modify: `src/tests/teamIterationTabs.test.tsx`

- [ ] **Step 1: Add failing tab UI tests**

In `src/tests/teamIterationTabs.test.tsx`, update the first iteration fixture:

```ts
  {
    id: 'manual-1',
    name: 'Manual 1',
    type: 'manual',
    status: 'ready',
    isPreferred: true,
    note: 'Best balance so far.',
    teams: [],
    unassignedPlayers: [],
    createdAt: '2026-04-21T10:00:00.000Z',
  },
```

Update existing `TeamIterationTabs` renders to include:

```tsx
        onEditIteration={vi.fn()}
        onMarkPreferred={vi.fn()}
        onMarkFinal={vi.fn()}
```

Add these tests:

```ts
  it('shows preferred and note badges for draft tabs', () => {
    render(
      <TeamIterationTabs
        iterations={iterations}
        activeIterationId="manual-1"
        onSelectIteration={vi.fn()}
        onCopyIteration={vi.fn()}
        onDeleteIteration={vi.fn()}
        onEditIteration={vi.fn()}
        onMarkPreferred={vi.fn()}
        onMarkFinal={vi.fn()}
        onAddManualIteration={vi.fn()}
      />
    );

    expect(screen.getByText('Preferred')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('calls preferred and final handlers from tab actions', () => {
    const onMarkPreferred = vi.fn();
    const onMarkFinal = vi.fn();

    render(
      <TeamIterationTabs
        iterations={iterations}
        activeIterationId="manual-1"
        onSelectIteration={vi.fn()}
        onCopyIteration={vi.fn()}
        onDeleteIteration={vi.fn()}
        onEditIteration={vi.fn()}
        onMarkPreferred={onMarkPreferred}
        onMarkFinal={onMarkFinal}
        onAddManualIteration={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Manual 2' }));
    fireEvent.click(screen.getByText('Mark Preferred'));

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Manual 2' }));
    fireEvent.click(screen.getByText('Mark Final'));

    expect(onMarkPreferred).toHaveBeenCalledWith('manual-2');
    expect(onMarkFinal).toHaveBeenCalledWith('manual-2');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run src/tests/teamIterationTabs.test.tsx
```

Expected: FAIL because the new props, badges, and action menu do not exist.

- [ ] **Step 3: Update `TeamIterationTabs`**

In `src/components/TeamIterationTabs.tsx`, update the icon import:

```ts
import { Copy, FileText, Flag, Loader2, MoreHorizontal, Plus, SquarePen, Star, Trash2 } from 'lucide-react';
```

Update the props interface:

```ts
interface TeamIterationTabsProps {
  iterations: TeamIteration[];
  activeIterationId: string | null;
  onSelectIteration: (iterationId: string) => void;
  onCopyIteration: (iterationId: string) => void;
  onDeleteIteration: (iterationId: string) => void;
  onEditIteration: (iterationId: string) => void;
  onMarkPreferred: (iterationId: string) => void;
  onMarkFinal: (iterationId: string) => void;
  onAddManualIteration: () => void;
  className?: string;
}
```

Add badges after the iteration label:

```tsx
              {iteration.isPreferred && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Preferred
                </span>
              )}
              {iteration.isFinal && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Final
                </span>
              )}
              {iteration.note && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <FileText className="h-3 w-3" />
                  Note
                </span>
              )}
```

Replace the separate copy/delete side buttons with this menu:

```tsx
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={`More actions for ${iterationLabel}`}
                  className={cn(
                    'inline-flex items-center justify-center rounded-r-xl border border-b-0 border-l-0 px-3 transition-colors',
                    isActive
                      ? 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  )}
                  aria-label={`More actions for ${iterationLabel}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={() => onEditIteration(iteration.id)}>
                  <SquarePen className="h-4 w-4" />
                  Edit Name & Note
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onCopyIteration(iteration.id)}
                  disabled={iteration.status !== 'ready'}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate Draft
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onMarkPreferred(iteration.id)}
                  disabled={iteration.status !== 'ready'}
                >
                  <Star className="h-4 w-4" />
                  Mark Preferred
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onMarkFinal(iteration.id)}
                  disabled={iteration.status !== 'ready'}
                >
                  <Flag className="h-4 w-4" />
                  Mark Final
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDeleteIteration(iteration.id)} className="text-red-600 focus:text-red-700">
                  <Trash2 className="h-4 w-4" />
                  Delete Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
```

- [ ] **Step 4: Add App handlers**

In `src/App.tsx`, update the `@/utils/teamIterations` import:

```ts
  markTeamIterationFinal,
  markTeamIterationPreferred,
  updateTeamIterationMetadata,
```

Add these handlers after `handleRenameIteration`:

```ts
  const handleUpdateIterationMetadata = useCallback((iterationId: string, updates: { name?: string; note?: string }) => {
    const trimmedName = updates.name?.trim();
    if (updates.name !== undefined && !trimmedName) {
      toast.error('Enter a draft name first');
      return;
    }

    snapshotCurrentState();

    setAppState(prev => {
      const finalName = trimmedName
        ? getUniqueIterationName(trimmedName, prev.teamIterations ?? [], iterationId)
        : undefined;

      return updateTeamIterationMetadata(prev, iterationId, {
        name: finalName,
        note: updates.note,
      });
    });

    toast.success('Draft details saved');
  }, [snapshotCurrentState]);

  const handleMarkIterationPreferred = useCallback((iterationId: string) => {
    snapshotCurrentState();
    setAppState(prev => markTeamIterationPreferred(prev, iterationId));
    toast.success('Marked preferred draft');
  }, [snapshotCurrentState]);

  const handleMarkIterationFinal = useCallback((iterationId: string) => {
    snapshotCurrentState();
    setAppState(prev => markTeamIterationFinal(prev, iterationId));
    toast.success('Marked final draft');
  }, [snapshotCurrentState]);
```

Pass these handlers into `FullScreenTeamBuilder`:

```tsx
        onUpdateIterationMetadata={handleUpdateIterationMetadata}
        onMarkIterationPreferred={handleMarkIterationPreferred}
        onMarkIterationFinal={handleMarkIterationFinal}
```

- [ ] **Step 5: Run tab tests**

Run:

```bash
pnpm vitest run src/tests/teamIterationTabs.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run TypeScript check**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS after all new `TeamIterationTabs` call sites provide the new props.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add src/App.tsx src/components/TeamIterationTabs.tsx src/tests/teamIterationTabs.test.tsx
git commit -m "Add draft metadata controls"
```

---

### Task 3: Add Big Board read-only components

**Files:**
- Create: `src/components/teams/CompactPlayerRow.tsx`
- Create: `src/components/teams/CompactTeamCard.tsx`
- Create: `src/components/teams/BigBoardView.tsx`
- Create: `src/tests/BigBoardView.test.tsx`

- [ ] **Step 1: Add failing Big Board tests**

Create `src/tests/BigBoardView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BigBoardView } from '@/components/teams/BigBoardView';
import type { LeagueConfig, Team } from '@/types';

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
  targetTeams: 2,
};

const teams: Team[] = [
  {
    id: 'team-1',
    name: 'Blue Comets',
    color: '#2563eb',
    players: [
      {
        id: 'player-1',
        name: 'Alex Runner',
        gender: 'M',
        skillRating: 7,
        execSkillRating: 8,
        teammateRequests: [],
        avoidRequests: [],
        isHandler: true,
        isNewPlayer: false,
      },
      {
        id: 'player-2',
        name: 'Blair Cutter',
        gender: 'F',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
        isNewPlayer: true,
      },
    ],
    averageSkill: 7,
    genderBreakdown: { M: 1, F: 1, Other: 0 },
    handlerCount: 1,
  },
];

describe('BigBoardView', () => {
  it('renders all teams and compact player signals', () => {
    render(<BigBoardView teams={teams} config={config} draftName="Final Candidate" />);

    expect(screen.getByText('Final Candidate')).toBeInTheDocument();
    expect(screen.getByText('Blue Comets')).toBeInTheDocument();
    expect(screen.getByText('Alex Runner')).toBeInTheDocument();
    expect(screen.getByText('Blair Cutter')).toBeInTheDocument();
    expect(screen.getByText('Exec 8')).toBeInTheDocument();
    expect(screen.getByText('Handler')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows an empty message when there are no teams', () => {
    render(<BigBoardView teams={[]} config={config} draftName="Empty Draft" />);

    expect(screen.getByText('No teams to show yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run src/tests/BigBoardView.test.tsx
```

Expected: FAIL because `BigBoardView` does not exist.

- [ ] **Step 3: Create `CompactPlayerRow`**

Create `src/components/teams/CompactPlayerRow.tsx`:

```tsx
import type { Player } from '@/types';
import { getEffectiveSkillRating } from '@/types';

interface CompactPlayerRowProps {
  player: Player;
}

export function CompactPlayerRow({ player }: CompactPlayerRowProps) {
  const effectiveSkill = getEffectiveSkillRating(player);
  const execLabel = player.execSkillRating !== null && player.execSkillRating !== undefined
    ? `Exec ${player.execSkillRating}`
    : `Skill ${effectiveSkill}`;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5 text-xs shadow-sm">
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-800">{player.name}</div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span>{player.gender}</span>
          {player.isHandler && <span>Handler</span>}
          {player.isNewPlayer && <span>New</span>}
        </div>
      </div>
      <div className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
        {execLabel}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `CompactTeamCard`**

Create `src/components/teams/CompactTeamCard.tsx`:

```tsx
import type { LeagueConfig, Team } from '@/types';
import { CompactPlayerRow } from './CompactPlayerRow';

interface CompactTeamCardProps {
  team: Team;
  config: LeagueConfig;
}

export function CompactTeamCard({ team, config }: CompactTeamCardProps) {
  const playerCount = team.players.length;
  const maxTeamSize = config.maxTeamSize;
  const teamColor = team.color || '#475569';

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm" aria-label={team.name}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: teamColor }} />
            <h3 className="truncate text-sm font-black text-slate-900">{team.name}</h3>
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">
            {playerCount}/{maxTeamSize} players · Avg {team.averageSkill.toFixed(1)} · Handlers {team.handlerCount ?? team.players.filter(player => player.isHandler).length}
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-white px-2 py-1 text-[10px] font-bold text-slate-600 shadow-sm">
          M {team.genderBreakdown.M} / F {team.genderBreakdown.F}
        </div>
      </div>

      <div className="space-y-1.5">
        {team.players.map(player => (
          <CompactPlayerRow key={player.id} player={player} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `BigBoardView`**

Create `src/components/teams/BigBoardView.tsx`:

```tsx
import type { LeagueConfig, Team } from '@/types';
import { CompactTeamCard } from './CompactTeamCard';

interface BigBoardViewProps {
  teams: Team[];
  config: LeagueConfig;
  draftName?: string;
}

export function BigBoardView({ teams, config, draftName }: BigBoardViewProps) {
  const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);

  if (teams.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-100 p-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800">No teams to show yet</h2>
          <p className="mt-2 text-slate-500">Create or open a draft before using Big Board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-100 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Big Board</div>
          <h2 className="text-xl font-black text-slate-900">{draftName || 'Current Draft'}</h2>
        </div>
        <div className="flex gap-2 text-xs font-bold text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">{teams.length} teams</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{totalPlayers} players</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7 min-[2600px]:grid-cols-8">
        {teams.map(team => (
          <CompactTeamCard key={team.id} team={team} config={config} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run Big Board tests**

Run:

```bash
pnpm vitest run src/tests/BigBoardView.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add src/components/teams/CompactPlayerRow.tsx src/components/teams/CompactTeamCard.tsx src/components/teams/BigBoardView.tsx src/tests/BigBoardView.test.tsx
git commit -m "Add read-only big board view"
```

---

### Task 4: Integrate Big Board and draft details in full-screen builder

**Files:**
- Modify: `src/components/FullScreenTeamBuilder.tsx`
- Modify: `src/tests/fullScreenTeamBuilder.test.tsx`

- [ ] **Step 1: Update full-screen builder tests to fail first**

In `src/tests/fullScreenTeamBuilder.test.tsx`, add:

```ts
vi.mock('@/components/teams/BigBoardView', () => ({
  BigBoardView: ({ draftName }: { draftName?: string }) => <div data-testid="big-board-view">{draftName}</div>,
}));
```

Update `renderWorkspace` to pass:

```tsx
      onUpdateIterationMetadata={vi.fn()}
      onMarkIterationPreferred={vi.fn()}
      onMarkIterationFinal={vi.fn()}
```

Add these tests:

```ts
  it('switches between editing and Big Board views', () => {
    renderWorkspace({ teams: iteration.teams });

    expect(screen.getByTestId('team-board')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Big Board' }));

    expect(screen.getByTestId('big-board-view')).toBeInTheDocument();
    expect(screen.queryByTestId('team-board')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Editing' }));

    expect(screen.getByTestId('team-board')).toBeInTheDocument();
  });

  it('saves draft name and note from the draft details dialog', () => {
    const onUpdateIterationMetadata = vi.fn();
    renderWorkspace({ onUpdateIterationMetadata });

    fireEvent.click(screen.getByRole('button', { name: 'Draft Details' }));
    fireEvent.change(screen.getByLabelText('Draft name'), { target: { value: 'Final Candidate' } });
    fireEvent.change(screen.getByLabelText('Draft note'), { target: { value: 'Best gender and handler balance.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Details' }));

    expect(onUpdateIterationMetadata).toHaveBeenCalledWith(iteration.id, {
      name: 'Final Candidate',
      note: 'Best gender and handler balance.',
    });
  });

  it('calls preferred and final handlers from active draft controls', () => {
    const onMarkIterationPreferred = vi.fn();
    const onMarkIterationFinal = vi.fn();
    renderWorkspace({ onMarkIterationPreferred, onMarkIterationFinal });

    fireEvent.click(screen.getByRole('button', { name: 'Mark Preferred' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Final' }));

    expect(onMarkIterationPreferred).toHaveBeenCalledWith(iteration.id);
    expect(onMarkIterationFinal).toHaveBeenCalledWith(iteration.id);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run src/tests/fullScreenTeamBuilder.test.tsx
```

Expected: FAIL because Big Board and draft details controls are not wired.

- [ ] **Step 3: Update imports and props**

In `src/components/FullScreenTeamBuilder.tsx`, update lucide import:

```ts
import { ArrowLeft, RotateCcw, PanelLeftClose, PanelLeft, Undo2, Redo2, AlertTriangle, Loader2, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, Copy, FileText, Flag, LayoutGrid, SquarePen, Star, Trash2 } from 'lucide-react';
```

Add:

```ts
import { BigBoardView } from './teams/BigBoardView';
```

Add props to `FullScreenTeamBuilderProps` and destructure them:

```ts
  onUpdateIterationMetadata: (iterationId: string, updates: { name?: string; note?: string }) => void;
  onMarkIterationPreferred: (iterationId: string) => void;
  onMarkIterationFinal: (iterationId: string) => void;
```

- [ ] **Step 4: Add view mode and draft detail state**

Replace rename-only state with:

```ts
  const [viewMode, setViewMode] = useState<'editing' | 'big-board'>('editing');
  const [isDraftDetailsDialogOpen, setIsDraftDetailsDialogOpen] = useState(false);
  const [draftNameInput, setDraftNameInput] = useState('');
  const [draftNoteInput, setDraftNoteInput] = useState('');
```

Replace rename handlers with:

```ts
  const handleOpenDraftDetailsDialog = () => {
    if (!activeIteration) {
      return;
    }

    setDraftNameInput(activeIteration.name);
    setDraftNoteInput(activeIteration.note ?? '');
    setIsDraftDetailsDialogOpen(true);
  };

  const handleConfirmDraftDetails = () => {
    if (!activeIteration) {
      return;
    }

    onUpdateIterationMetadata(activeIteration.id, {
      name: draftNameInput,
      note: draftNoteInput,
    });
    setIsDraftDetailsDialogOpen(false);
  };
```

- [ ] **Step 5: Wire tab metadata props**

Update the `TeamIterationTabs` call:

```tsx
              onEditIteration={(iterationId) => {
                onSelectIteration(iterationId);
                const selectedIteration = iterations.find(iteration => iteration.id === iterationId);
                if (selectedIteration) {
                  setDraftNameInput(selectedIteration.name);
                  setDraftNoteInput(selectedIteration.note ?? '');
                  setIsDraftDetailsDialogOpen(true);
                }
              }}
              onMarkPreferred={onMarkIterationPreferred}
              onMarkFinal={onMarkIterationFinal}
```

- [ ] **Step 6: Add active draft controls and Big Board toggle**

In the active draft action group, replace `Rename Draft` with these controls:

```tsx
                <Button
                  type="button"
                  variant={viewMode === 'big-board' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={() => setViewMode(viewMode === 'big-board' ? 'editing' : 'big-board')}
                >
                  <LayoutGrid className="h-4 w-4" />
                  {viewMode === 'big-board' ? 'Back to Editing' : 'Big Board'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={handleOpenDraftDetailsDialog}
                >
                  <FileText className="h-4 w-4" />
                  Draft Details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
                  onClick={() => onMarkIterationPreferred(activeIteration.id)}
                  disabled={activeIteration.status !== 'ready'}
                >
                  <Star className="h-4 w-4" />
                  Mark Preferred
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                  onClick={() => onMarkIterationFinal(activeIteration.id)}
                  disabled={activeIteration.status !== 'ready'}
                >
                  <Flag className="h-4 w-4" />
                  Mark Final
                </Button>
```

- [ ] **Step 7: Render Big Board outside drag-and-drop**

In the main content conditional, add the Big Board branch before `<DndContext>`:

```tsx
      ) : viewMode === 'big-board' ? (
        <BigBoardView teams={sortedTeams} config={config} draftName={activeIteration?.name} />
      ) : (
        <DndContext
```

- [ ] **Step 8: Replace rename dialog with draft details dialog**

Replace the current rename dialog block:

```tsx
      <Dialog open={isDraftDetailsDialogOpen} onOpenChange={setIsDraftDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Draft Details</DialogTitle>
            <DialogDescription>
              Give this draft a clear name and note so it is easy to compare and revisit later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="draft-name">Draft name</Label>
              <Input
                id="draft-name"
                value={draftNameInput}
                onChange={(event) => setDraftNameInput(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-note">Draft note</Label>
              <Input
                id="draft-note"
                value={draftNoteInput}
                onChange={(event) => setDraftNoteInput(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDraftDetailsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDraftDetails}>
              Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 9: Run full-screen builder tests**

Run:

```bash
pnpm vitest run src/tests/fullScreenTeamBuilder.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Run related component tests**

Run:

```bash
pnpm vitest run src/tests/fullScreenTeamBuilder.test.tsx src/tests/teamIterationTabs.test.tsx src/tests/BigBoardView.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit Task 4**

Run:

```bash
git add src/components/FullScreenTeamBuilder.tsx src/tests/fullScreenTeamBuilder.test.tsx
git commit -m "Integrate big board and draft details"
```

---

### Task 5: Final verification and cleanup

**Files:**
- Review all files changed by Tasks 1-4.

- [ ] **Step 1: Run the focused test set**

Run:

```bash
pnpm vitest run src/tests/teamIterations.test.ts src/tests/teamIterationTabs.test.tsx src/tests/BigBoardView.test.tsx src/tests/fullScreenTeamBuilder.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
pnpm test:run
```

Expected: PASS. If an unrelated existing test fails, capture the failing test name and rerun it once before changing code.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Manual browser check**

Run:

```bash
pnpm dev
```

Open the local Vite URL shown in the terminal. Check:

- Existing team editing still shows the sidebar and team board.
- Draft Details opens and saves a name plus note.
- Mark Preferred shows one preferred draft.
- Mark Final shows one final draft.
- Duplicate Draft creates a new copy without preferred/final markers.
- Big Board hides the sidebar and shows compact teams.
- Back to Editing restores the normal drag-and-drop workspace.

Stop the dev server after the check.

- [ ] **Step 6: Commit final verification fixes if files changed**

If verification required small fixes, commit them:

```bash
git add src/types/index.ts src/utils/teamIterations.ts src/App.tsx src/components/TeamIterationTabs.tsx src/components/FullScreenTeamBuilder.tsx src/components/teams/CompactPlayerRow.tsx src/components/teams/CompactTeamCard.tsx src/components/teams/BigBoardView.tsx src/tests/teamIterations.test.ts src/tests/teamIterationTabs.test.tsx src/tests/BigBoardView.test.tsx src/tests/fullScreenTeamBuilder.test.tsx
git commit -m "Verify draft versions and big board workflow"
```

If no files changed after verification, do not create an empty commit.
