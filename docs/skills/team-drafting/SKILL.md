---
name: teambuilder-team-drafting
description: Use for this repo when building Barrie Ultimate League season teams from a roster workbook, generating team drafts, validating team balance, or preparing generated teams for TeamBuilder workspace publishing.
---

# TeamBuilder Team Drafting

Use this repo-only skill whenever Mike asks to build teams, draft teams, balance a season roster, or upload generated teams into the TeamBuilder website.

## Start here

1. Read `AGENTS.md`, `README.md`, `context.md`, and `TEAM_DRAFT_PRIORITIES.md`.
2. Ask Mike for the team count every run. Do not assume it.
3. Confirm the workbook has drafting metadata columns before drafting:
   - `Must Play Group` or `Player Requests`
   - `Nice To Play` or `Would like to play with`
   - `Female Leader`
   - `Male Leader Tier`
   - `Handler`
   - `New/Returning`
4. Use `Self Rank` as the default skill rating, not `Self Rank No Division`.
5. Use `Exec Skill Rating` instead of `Self Rank` only when an explicit exec rating is present.

## Drafting rules

Apply this priority order:

1. Keep hard must-play groups together.
2. Keep hard avoid requests apart.
3. Balance male/female counts.
   - Treat per-gender spread as a hard target: the highest and lowest male counts should differ by no more than 1, and the highest and lowest female counts should differ by no more than 1.
   - Do not accept a draft with teams like 10M and 8M unless must-play or avoid constraints make the <=1 spread impossible; if that happens, report it clearly before proceeding.
4. Spread leaders:
   - female Leader A uses `leader-a-female`; legacy `heart` labels still count as female leader coverage
   - female Leader A supersedes female Leader B; do not keep both labels on the same player
   - male leader A uses `leader-a-male`
   - male leader B uses `leader-b-male`
   - target each team having either one male Leader A or two male Leader B players where possible
5. Respect mutual nice-to-play requests.
   - Target honoring at least 75% of mutual nice-to-play pairs.
   - Build with mutual nice clusters when practical so these requests are not treated as afterthoughts.
   - Break a mutual nice-to-play pairing when needed to cover a team missing a male or female leader.
   - If a variation is below 75%, treat it as not acceptable unless the report shows higher-priority constraints made the target impossible.
6. Balance skill.
7. Balance handlers.
8. Balance new vs. returning players.
9. Balance young vs. wise players.

Higher priority always beats lower priority.

Before drafting, calculate the ideal team-size and gender-count bands from the roster totals. Use these bands when judging variations.

## Column interpretation

- `Player Requests`: hard only when mutual with another `Player Requests` entry. One-way requests do not count by themselves.
- `Must Play Group`: hard explicit group when present.
- `Would like to play with` and `Nice To Play`: soft nice-to-play preferences only when mutual. One-way nice-to-play requests are ignored for scoring.
- `Do_Not_Play` and `Avoid Requests`: hard avoid requests.
- `Female Leader`: yes/no. Female yes becomes `leader-a-female`; legacy `heart` is accepted for old files.
- `Male Leader Tier`: `A` or `B`.
- `Handler`: yes/no.
- `New/Returning`: `new` or `returning`.
- Young means age `<= 21`; wise means age `>= 44`.

If a hard group is larger than the target team size, stop and report it. Do not split it. If a hard group contains an avoid conflict, stop and report it.

## Request mapping before drafting

- Run a request-mapping audit before building teams.
- Auto-match clear spelling, nickname, and partial-name variants only when there is one clear roster candidate.
- Do not silently guess ambiguous names for hard must-play requests.
- If Mike confirms unmatched names are not registered, ignore those requests and continue.
- Report one-way nice-to-play requests as ignored, not broken.

## Variation review

When Mike asks for multiple options, generate separate variations and compare them before recommending one. For each variation, report:

- hard-rule status
- team sizes
- male/female spread
- leader coverage
- skill spread
- handler spread
- mutual nice-to-play requests honored

When Mike asks for a per-team report, start with the requested variation and list each team with roster size, male/female count, leaders, and nice requests honored.

## Build command

Use the helper script:

```bash
pnpm tsx scripts/build-season-teams.ts \
  --workbook "C:/Users/Mike McConnell/Downloads/Summer2026_self_rank.xlsx" \
  --sheet "Roster Self Rank" \
  --team-count <ASK_EACH_RUN> \
  --season "Summer Outdoor 2026" \
  --out-dir output/summer-2026
```

Expected outputs:

- normalized roster CSV
- generated teams CSV
- validation report Markdown
- JSON audit file

Review the validation report before publishing.

## Publish command

After the report is acceptable, publish with:

```bash
pnpm workspace:publish -- \
  --roster "<normalized-roster.csv>" \
  --teams "<generated-teams.csv>" \
  --project-name "Summer Outdoor 2026 Draft"
```

Add `--publish firestore --user-email <email>` only when Mike explicitly wants the workspace published to Firestore.

## Verification

Before saying teams are ready:

1. Run the helper script successfully.
2. Confirm hard rules pass in the validation report.
3. Run:
   ```bash
   pnpm vitest run src/tests/buildSeasonTeams.test.ts src/tests/publishGeneratedWorkspace.test.ts
   ```
4. If publishing, confirm `workspace:publish` completes and report the backup/workspace path.
