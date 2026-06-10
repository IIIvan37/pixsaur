---
name: session-report
description: Close a refactor step with a resumable session report. Use at the end of every step/PR of the clean-archi refactor so a fresh session can pick up exactly where this one left off. Updates the canonical docs/refactor/STATUS.md and appends a dated report under docs/refactor/sessions/.
---

# Session report (close a refactor step)

Produce the artifacts that let a new session resume with zero context loss.
Run this at the end of each step/PR, before stopping.

## 1. Gather the real state (don't guess)

```
export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"   # WSL: node not on PATH
date +%F                       # the report's date / filename prefix
git branch --show-current
git status --short
corepack pnpm refactor:preflight   # current knip + jscpd numbers
```

Compare the knip/jscpd numbers against the baseline in `docs/refactor/STATUS.md`.
A regression (more dead code / duplication than baseline) must be called out —
and ideally fixed before reporting done.

## 2. Append a dated session report

- Copy `docs/refactor/sessions/_TEMPLATE.md` to
  `docs/refactor/sessions/<YYYY-MM-DD>-<slug>.md` (slug = the step, e.g.
  `pr1-export-ports`). Never overwrite an existing report — history is append-only.
- Fill every section honestly: Done, Not done / remaining, Decisions,
  Guardrail status (with the numbers from step 1), State to resume from.
- "State to resume from" must name the SINGLE next action and any gotchas /
  half-done edits.

## 3. Update the canonical STATUS

Edit `docs/refactor/STATUS.md`:
- Move the roadmap table row(s) to ✅ / update status.
- Update "Where we are" (branch, current step, next step).
- If a detector number genuinely improved, lower the ratchet baseline (never
  raise it to hide a regression).

## 4. Keep memory in sync (optional, if the plan shifted)

If a cross-session decision changed, update the `refactor-clean-archi-plan`
memory note. Don't duplicate the whole report there — just the durable decision.

## Output

End with a 3-line summary to the user: what's done, the next action, and the
report path.
