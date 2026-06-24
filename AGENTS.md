# Agent Guide for TeamBuilder

## Source of truth

Use this order when starting work:

1. `README.md` for setup and current workflow.
2. `context.md` for architecture and state model.
3. Current code under `src/`, `api/`, `scripts/`, and Firebase/Vercel config.
4. Historical reports only when investigating old decisions.

## What not to trust as current

- `.tmp-deploy-fix*` directories
- `backup-*` files
- dated handoff files
- old project reports
- generated roster/team output files

These may be useful history, but they are not authoritative.

## Verification

Before finishing meaningful changes, run the smallest useful check, then broaden when practical:

```bash
pnpm lint
pnpm test:run
pnpm test:rules
pnpm build
```

Use `pnpm verify` for the full local verification path.

## Current app shape

TeamBuilder is a React/Vite app with Firebase persistence and Vercel AI endpoints. The current primary UI is manual-scenario first: upload roster, configure league rules, review roster warnings/groups, create team scenarios, edit in full-screen workspace, review in Big Board, and export/save the project.
