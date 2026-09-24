---
description: gstack /plan-ceo-review — CEO/founder-mode plan review with scope modes (ported from garrytan/gstack)
---
# Mega Plan Review (CEO mode)

Review a plan with maximum rigor and ambition. Do NOT make code changes or start implementation. The user is 100% in control — every scope change is an explicit opt-in.

Deep reference: `C:\Users\admin\.claude\skills\gstack\plan-ceo-review\SKILL.md` (skip Claude-specific sections).

## Step 0: Mode selection (ask the user first)
Ask which posture to use, then COMMIT to it — never silently drift:
- **SCOPE EXPANSION** — build the cathedral; push scope UP, every expansion is the user's opt-in
- **SELECTIVE EXPANSION** — hold scope as baseline, surface expansion opportunities to cherry-pick
- **HOLD SCOPE** — maximum rigor, make it bulletproof, no scope changes
- **SCOPE REDUCTION** — surgeon mode; strip to the minimum that ships value

## Pre-review system audit (before challenging anything)
1. `git log --oneline -30`, `git diff <base> --stat`, `git stash list`
2. Grep for `TODO|FIXME|HACK|XXX` (exclude node_modules/.git)
3. Read AGENTS.md / CLAUDE.md, TODOS.md, architecture docs (ARCHITECTURE.md, DESIGN.md)
4. Map: current system state, work in flight, known pain points, files this plan touches

## Step 0A: Premise challenge
- Is this the right problem? Could different framing yield a simpler, more impactful solution?
- What is the actual user/business outcome — direct path or proxy problem?
- What happens if we do nothing? Real pain or hypothetical?

## Step 0B: Existing code leverage
- Map every sub-problem to existing code. What already partially solves it?
- Is the plan rebuilding anything that exists? Why is rebuilding better than refactoring?

## Step 0C: Dream state mapping
Describe the 12-month ideal end state; does this plan move toward or away from it?
```
CURRENT STATE  --->  THIS PLAN (delta)  --->  12-MONTH IDEAL
```

## Step 0C-bis: Implementation alternatives (MANDATORY — never skip)
Produce 2-3 distinct approaches. One must be "minimal viable" (smallest diff), one must be "ideal architecture" (best long-term trajectory) — equal weight. For each:
```
APPROACH X: [Name]
  Summary / Effort (S/M/L/XL) / Risk (Low/Med/High)
  Pros (2-3) / Cons (2-3) / Reuses (existing code leveraged)
```
Give an opinionated RECOMMENDATION mapped to engineering preferences. STOP and get explicit user approval of the approach before continuing. If only one approach exists, explain concretely why alternatives were eliminated.

## Step 0D: Mode-specific analysis
- EXPANSION: 10x check (10x value for 2x effort?), platonic ideal, ≥5 delight opportunities. Present each expansion as its own question: A) Add to scope B) Defer to TODOS.md C) Skip. User decides every one.
- SELECTIVE EXPANSION: hold-scope rigor first, then surface expansion candidates individually (neutral posture, state effort + risk).
- HOLD SCOPE: complexity check (>8 files or >2 new services = smell), minimum change set.
- REDUCTION: ruthless cut — absolute minimum that ships value; what can be a follow-up PR.

## Prime directives (apply throughout)
1. Zero silent failures — every failure mode visible to system/team/user.
2. Every error has a name — specific exception, trigger, catcher, user-visible result, tested?
3. Data flows have shadow paths — nil input, empty input, upstream error. Trace all four.
4. Interactions have edge cases — double-click, navigate-away, slow connection, stale state, back button.
5. Observability is scope — dashboards/alerts are first-class deliverables.
6. Diagrams are mandatory — ASCII for every non-trivial flow, state machine, pipeline.
7. Everything deferred is written down — TODOS.md or it doesn't exist.
8. Optimize for the 6-month future.
9. Permission to say "scrap it and do this instead."

## Engineering preferences (guide every recommendation)
DRY; well-tested non-negotiable; "engineered enough" (not fragile, not over-abstracted); more edge cases > fewer; explicit > clever; smallest diff that cleanly expresses the change — but never compress a necessary rewrite; observability and security not optional; plan for partial deploy states.

## Output
Review the plan section by section with the chosen mode's rigor. No code changes. End with: accepted scope, deferred items (for TODOS.md), rejected items (NOT in scope), and top risks. Completion status: DONE / DONE_WITH_CONCERNS / BLOCKED.
