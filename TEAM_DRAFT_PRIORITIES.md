# Team Draft Priorities

This file captures the default priority order for AI-generated team drafts in TeamBuilder for this workspace.

## Default team count

- Build **10 teams** unless a newer instruction overrides this.

## Priority order

Use this sequence when generating teams:

1. **Keep must-play groups together**  
   - This is the top priority.
   - Must-play groups are **non-negotiable** and must not be broken.
   - Use the must-play column as the source of truth for these groups.

2. **Balance male and female counts**  
   - Distribute male and female players as evenly as possible across teams.
   - The gender-count spread should be **no more than 1** for each gender whenever mathematically possible.
   - Example: do not accept one team with 10 males and another with 8 males unless higher-priority hard constraints make that unavoidable.

3. **Spread leaders**  
   - Players with the `leader-a-female` label are female Leader A players.
   - Female Leader A supersedes Female Leader B; a player should not carry both labels.
   - Legacy `heart` labels still count as female leader coverage.
   - Spread female leaders as evenly as possible across teams.
   - Target **at least 1 female Leader A per team** when there are enough.
   - Spread male leaders so each team has **either 1 Leader A male or 2 Leader B males** where possible.
   - If there are not enough leaders to cover every team, minimize the number of teams without leader coverage.

4. **Respect mutual nice-to-play requests**  
   - Target honoring at least **75%** of mutual nice-to-play pairs.
   - Prefer draft structures that keep mutual nice clusters together when this does not break higher-priority hard rules.
   - Split a nice-to-play pairing when needed to give every team male and female leader coverage.
   - A draft below 75% is not acceptable unless higher-priority constraints make the target impossible.

5. **Balance skill level**  
   - For Summer Outdoor 2026, use the registration questions normalized to 10 and averaged.
   - Include Skill Level, Speed, Throwing, Defence, Handling, Offense, and Division Level.
   - Do not include Rules or Experience.
   - Do not use exec ratings unless Mike explicitly asks for them.

6. **Balance handlers**  
   - Spread handlers as evenly as possible after the higher priorities are satisfied.

7. **Balance new vs. returning players**  
   - This is a soft preference, not a hard rule.

8. **Balance young vs. wise players**  
   - This is also a soft preference, after the higher priorities above.

## Constraint interpretation

- If priorities conflict, the **higher priority wins**.
- Must-play group integrity always beats every other balancing goal.
- Male/female balance outranks skill balance.
- Leader spread outranks skill balance.
- Mutual nice-to-play target outranks skill and handler balance.
- Skill balance outranks handler balance.
- Nice-to-play, new/returning, and young/wise balance are preferences only.

## Practical summary

When generating AI teams:

- first protect must-play groups
- then balance gender counts
- then spread female and male leaders
- then hit the 75% mutual nice-to-play target
- then balance skill
- then balance handlers
- then respect mutual nice-to-play requests
- then improve new/returning spread
- then improve young/wise spread
