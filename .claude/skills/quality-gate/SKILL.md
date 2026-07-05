---
name: quality-gate
description: Run the pixsaur quality guardrails (typecheck + comprehensive typecheck + biome & custom guards + tests with coverage + knip dead-code + jscpd duplication + Stryker on the pure core) and report. Use before declaring any change done, before a commit, or before opening a PR. Unlike a greenfield gate, pixsaur is a mature codebase mid-refactor — some detectors are ratcheted (report-only baseline), not zero-tolerance. Know which is which before you act.
---

# Quality gate (pixsaur)

All guardrails, one pass. Pixsaur is a **mature codebase in a strangler-fig
refactor**, so the posture differs from the greenfield template: some checks are
**blocking** (they run in the pre-commit hook / `pnpm check`), others are
**ratcheted** (a baseline you must not regress, tracked in
`docs/refactor/STATUS.md`). Don't "fix everything" blindly — respect the ratchet.

## Blocking (pre-commit hook + `pnpm check`)

These already gate every commit via `.husky/pre-commit`; a failure blocks:

1. `pnpm typecheck` — `tsc --noEmit`.
2. `pnpm typecheck:comprehensive` — all tsconfig projects + unused-symbol diagnostics.
3. `pnpm check` — Biome + the custom guards:
   - `scripts/check-console-usage.js` — no raw `console.*` in `src/` (use `@/core` loggers).
   - `scripts/check-radix-imports.js` — Radix only inside `src/components/ui`.
   - `scripts/check-tauri-imports.js` — `@tauri-apps/*` only inside `src/tauri`.
   - `scripts/check-layer-imports.js` — layering (`app/components → feature/application → domain → libs`, all → `core`).
4. `pnpm test` — Vitest (happy-dom).

## Ratcheted (run explicitly, don't regress the baseline)

5. `pnpm check:dead` — knip (orphan exports / dead code). Pixsaur has a known
   pre-existing list (types in `src/libs`, duplicate store exports); the rule is
   **no NEW orphan from your change**, not zero. `pnpm refactor:preflight` runs
   knip with `--no-exit-code` for this reason.
6. `pnpm check:dup` — jscpd (copy-paste). Same ratchet: don't add clones.
7. `pnpm test:coverage` — Vitest with v8 coverage.
8. `pnpm test:mutation` — **Stryker**, scoped to the pure core
   (`src/domain/cpc/**` + `src/libs/pixsaur-color/src/{histogram,space,utils,metric}/**`).
   Blocking on its own `thresholds.break` (72). Run it only when your change
   touched that scope — it takes ~1–7 min. The mutation-debt backlog (files not
   yet in scope) lives in `docs/refactor/PLAN-quality-gates-from-loupe.md`.

`pnpm refactor:preflight` = `tsc --noEmit && knip --no-exit-code && jscpd src`
is the fast pre-PR bundle for the refactor guardrails.

## How to read / react

- **typecheck**: zero tolerance. No `as any` to silence — fix the type.
- **custom guards**: a layer/console/radix/tauri violation = a boundary leak.
  Move the code to the right layer or behind a port; do NOT add to a guard's
  exception list without an ADR (the list is a ratchet — it only shrinks).
- **knip / jscpd**: new orphan → wire it or delete it; new clone → factor a
  shared helper (often pure domain). Pre-existing findings are baseline, not yours.
- **Stryker**: a surviving mutant = a test that passes without pinning behavior.
  Kill it by tightening the assertion (or add the missing example). Never raise
  `thresholds.break` to make it green — that's the anti-pattern this gate exists
  to prevent.

## Before declaring done

- Blocking checks green (the pre-commit hook would refuse otherwise).
- No NEW knip/jscpd finding vs baseline.
- If the change touched the mutated scope: `pnpm test:mutation` green.
- If the step is finished (not just verified), close it with `/session-report`.
