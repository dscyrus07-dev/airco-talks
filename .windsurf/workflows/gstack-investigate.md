---
description: gstack /investigate — systematic root-cause debugging, no fixes without investigation (ported from garrytan/gstack)
---
# Systematic Debugging

## Iron Law
**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**
Fixing symptoms creates whack-a-mole debugging. Find the root cause, then fix it.

Deep reference: `C:\Users\admin\.claude\skills\gstack\investigate\SKILL.md` (skip Claude-specific sections).

## Phase 1: Root cause investigation (gather context before any hypothesis)
1. Collect symptoms: read error messages, stack traces, reproduction steps. If context is missing, ask the user ONE question at a time.
2. Read the code: trace the path from symptom back to potential causes. Use code_search/grep_search to find all references, read_file to understand logic.
3. Check recent changes: `git log --oneline -20 -- <affected-files>`. Was this working before? What changed? A regression means the root cause is in the diff.
4. Reproduce: can the bug be triggered deterministically? If not, gather more evidence before proceeding (add logging, write a failing test).
5. Recurrence check: has this area been investigated/fixed before? Recurring bugs in the same area are an architectural smell — say so.

## Phase 2: Hypothesis formation
- State 2-3 candidate root causes, each with the evidence that supports or contradicts it.
- Design the cheapest experiment that discriminates between them (log statement, isolated test, targeted probe).
- Run the experiment. Eliminate hypotheses with evidence, not intuition.

## Phase 3: Fix at the root
- Implement the minimal upstream fix that addresses the root cause — one guard in the shared function beats guards in every caller. Verify the fix location carefully in specialized codebases.
- Prefer minimal changes; avoid over-engineering; single-line changes when sufficient.

## Phase 4: Verify and lock it in
- Add a regression test that fails without the fix and passes with it.
- Re-run the original reproduction: confirm it's gone.
- Check adjacent code for the same bug class.

## Rules
- Never jump from symptom to fix. If you catch yourself editing before Phase 1 completes, stop and go back.
- If a claimed limitation comes up ("the API can't do this"), demand evidence: verbatim error, docs, or a live probe — before accepting it.
- Escalate to the user after 3 failed fix attempts or when the fix is security-sensitive.
- End with: root cause (1-2 sentences), fix summary, test added, completion status (DONE / DONE_WITH_CONCERNS / BLOCKED).
