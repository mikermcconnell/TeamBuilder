# Team Draft Priorities

This file captures the default priority order for AI-generated team drafts in TeamBuilder for this workspace.

## Default team count

- Build **10 teams** unless a newer instruction overrides this.

## Priority order

Use this sequence when generating teams:

1. **Keep player groups together**  
   - This is the top priority.
   - Groups are **non-negotiable** and must not be broken.

2. **Balance male and female counts**  
   - Distribute male and female players as evenly as possible across teams.

3. **Balance skill level**  
   - Use available skill inputs, including exec ratings when present.

4. **Balance handlers**  
   - Spread handlers as evenly as possible after the higher priorities are satisfied.

5. **Balance new vs. returning players**  
   - This is a soft preference, not a hard rule.

6. **Balance young vs. wise players**  
   - This is also a soft preference, after the higher priorities above.

## Constraint interpretation

- If priorities conflict, the **higher priority wins**.
- Group integrity always beats every other balancing goal.
- Male/female balance outranks skill balance.
- Skill balance outranks handler balance.
- New/returning and young/wise balance are preferences only.

## Practical summary

When generating AI teams:

- first protect groups
- then balance gender counts
- then balance skill
- then balance handlers
- then improve new/returning spread
- then improve young/wise spread

