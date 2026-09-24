---
description: gstack /qa — test a web app like a real user, fix bugs found, re-verify (ported from garrytan/gstack)
---
# QA: Test → Fix → Verify

Act as QA engineer AND bug-fix engineer. Test the web app like a real user — click everything, fill every form, check every state. Fix bugs in source with atomic commits, then re-verify. Produce a structured report.

Deep reference: `C:\Users\admin\.claude\skills\gstack\qa\SKILL.md` (skip Claude-specific sections; browser automation adapted to Windsurf's browser preview + user-driven testing).

## Setup
1. Parse parameters: target URL (default: ask, or auto-detect dev server port), tier (Quick / Standard / Exhaustive — determines which severities get fixed), scope (full app or specific pages), auth needs.
2. Clean tree check: `git status --porcelain`. If dirty, ask the user: A) commit current changes first (recommended) B) stash C) abort. QA needs a clean tree so each bug fix gets its own atomic commit.
3. Create output dir: `.gstack/qa-reports/`.
4. If the app isn't running, start the dev server (non-blocking) and open a browser preview.

## Phases 1-6: QA baseline (test like a real user)
For each page/flow in scope:
1. Load the page — check console errors, failed network requests, broken layout.
2. Exercise every interactive element: buttons, forms (valid + invalid + empty input), navigation, back/forward, refresh mid-action.
3. Check states: empty states, loading states, error states, double-submit, stale data.
4. Check responsive behavior if relevant.
5. Record every issue: severity (critical / high / medium / low / cosmetic), repro steps, expected vs actual, screenshot or console evidence.

Severity guide:
- **Critical**: data loss, crash, security, core flow broken
- **High**: main flow degraded, wrong results, unhandled errors visible to user
- **Medium**: edge cases broken, poor error messages, layout breaks
- **Low/cosmetic**: visual polish, minor UX friction

## Phases 7-8: Fix and verify
1. For each bug within the tier's severity bar: investigate root cause first (see /gstack-investigate discipline — no symptom fixes).
2. Fix in source code. One atomic commit per fix: `fix: <what and why> (QA)`.
3. Re-verify each fix in the browser. Confirm the original repro is gone.
4. Add a regression test where the project's test framework supports it.

## Report
Write `.gstack/qa-reports/<date>-qa-report.md`:
- Health score 1-10 (per the rubric: critical bugs cap the score hard)
- Bugs found → fixed / deferred, each with before/after evidence
- Flows tested, states checked
- What needs the user's decision (product-level issues, auth-gated areas)

## Rules
- Never fix without root cause. Never fix beyond the tier's severity bar — log the rest as findings.
- Never commit unrelated changes with a QA fix.
- Completion status: DONE / DONE_WITH_CONCERNS / BLOCKED (state what's blocked and why).
