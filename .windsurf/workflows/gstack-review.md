---
description: gstack /review — pre-landing code review of the current branch diff (ported from garrytan/gstack)
---
# Pre-Landing PR Review

Analyze the current branch's diff against the base branch for structural issues tests don't catch. Fix-first, not read-only. Never commit, push, or create PRs.

Deep reference (read on demand for full checklist detail): `C:\Users\admin\.claude\skills\gstack\review\SKILL.md` and `C:\Users\admin\.claude\skills\gstack\review\checklist.md`. Skip all Claude-specific sections (Preamble, AskUserQuestion protocol, telemetry, Greptile).

## Steps

1. Detect base branch: `git remote get-url origin`. If GitHub and `gh` works, get default branch via gh; else fall back to `origin/HEAD`, then `main`, then `master`.
2. Branch check: `git branch --show-current`. If on the base branch, report "Nothing to review — you're on the base branch" and stop.
3. Scope drift check: read `TODOS.md` (if present) and commit messages (`git log origin/<base>..HEAD --oneline`) to get stated intent. Run `git diff (git merge-base origin/<base> HEAD) --stat` and compare against intent. Output before the review:
   - `Scope Check: [CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING]`
   - Intent (1 line), Delivered (1 line), list out-of-scope changes and unaddressed requirements. Informational — never blocks.
4. Get the full diff: `git fetch origin <base> --quiet` then `git diff (git merge-base origin/<base> HEAD)`. Read the FULL diff before commenting. Do not flag issues already addressed in the diff.
5. Critical pass — apply these categories to the diff:
   - SQL & data safety (injection, missing WHERE guards, migrations)
   - Race conditions & concurrency
   - LLM output trust boundary (unvalidated model output reaching DB/shell/UI)
   - Shell injection
   - Enum & value completeness — when the diff adds a new enum value/status/type, grep OUTSIDE the diff for all files referencing sibling values and verify the new value is handled everywhere
   - Async/sync mixing, type coercion, completeness gaps (error paths, edge cases)
6. Confidence calibration — every finding must be `[SEVERITY] (confidence: N/10) file:line — description`:
   - 9-10: verified by reading specific code. 7-8: high-confidence pattern. 5-6: show with "verify this" caveat. 4 and below: suppress to appendix.
   - Pre-emit gate: quote the exact motivating code line(s). If you cannot quote them, force confidence to 4-5 (appendix only).
7. Fix-first: classify each finding AUTO-FIX (mechanical, informational) or ASK (critical, judgment call).
   - Apply AUTO-FIX items directly; one line each: `[AUTO-FIXED] [file:line] Problem → what you did`
   - Batch ASK items into ONE question to the user: numbered list with severity, problem, recommended fix; options A) Fix B) Skip per item plus an overall RECOMMENDATION. Apply only approved fixes.
8. Verify claims: cite the specific line proving "safe", name the test file/method proving "tested". Never say "likely handled" — verify or flag unknown.
9. Docs staleness: if the diff changes behavior described in root-level .md docs (README, ARCHITECTURE) that were not updated, flag as informational.
10. Output header: `Pre-Landing Review: N issues (X critical, Y informational)`, then findings, then completion status: DONE / DONE_WITH_CONCERNS / BLOCKED (with reason).

## Rules
- Be terse: one line problem, one line fix. Only flag real problems.
- Fix at root cause, not symptom — prefer one guard in the shared function over guards in every caller.
- Never commit, push, or create PRs.
