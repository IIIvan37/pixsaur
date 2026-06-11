# Session report — 2026-06-11 — PR13 (paintPixels use-case)

## Goal of the session
Pivot from raster to the **editor** feature (the recommended next/biggest
target). Extract the paint orchestration inlined in `paintPixelAtom` +
`paintPixelsAtom` (`app/store/editor/editor-actions.ts`) into a single pure,
testable use-case under `src/editor/application/`. First editor use-case — seeds
the feature folder.

## Done
- **Use-case** `paintPixels(input, deps)` in
  `src/editor/application/paint-pixels.ts` (+ 12-test spec). **Pure,
  synchronous, total** — returns
  `{ changed, buffer, edits, history, historyIndex }`. It **unifies** the single
  click and the drag stroke (previously two near-duplicate atom bodies): per
  target it optionally expands to the 2-wide CPC pixel group on EGX low-res
  lines (`expandLowResGroups`, single click only), filters by bounds + the
  per-line EGX color limit, writes into a **copy** of the buffer (input never
  mutated), and — when anything changed — appends a history entry (timestamp via
  the `Clock` port), truncating any redone future and capping at
  `MAX_HISTORY_SIZE`. The shared history-management logic is now one helper.
- **Port** `Clock { now(): number }` in `src/editor/application/ports.ts` — the
  one impure dependency (was `Date.now()` for the history timestamp). Runtime
  adapter is `systemClock` (`{ now: () => Date.now() }`) defined in
  `editor-actions.ts`. Mirrors PR12's `IdGenerator` pattern.
- **Domain types moved to the application layer**: `PixelEdit`,
  `EditHistoryEntry`, `MAX_HISTORY_SIZE` now live in
  `src/editor/application/types.ts`; `editor-state.ts` **imports them for local
  use and re-exports** them, so the preview pipeline / barrels / specs that
  consume them are untouched.
- **Rewired + old path deleted:** both `paintPixelAtom` and `paintPixelsAtom`
  are now thin adapters — read atoms, inject the `Clock` port, call the
  use-case, guard `!result.changed`, write back
  (`editorHistoryAtom`, `editorHistoryIndexAtom`, `editorIndexBufferAtom`). The
  duplicated bounds/EGX/edit/history logic and the verbose `logger.warn` on
  EGX-limit were removed. `paintAtCursorAtom` still delegates to
  `paintPixelAtom`.
- Seeded the living registry `src/editor/application/README.md` (Domain types,
  Ports table with `Clock`, `paintPixels` row + status/reuse notes).

## Not done / remaining
- `undoEditAtom` / `redoEditAtom` stay thin store atoms — they just replay a
  history entry's `PixelEdit[]`; no orchestration worth extracting.
- `enterEditModeAtom` (async, captures EGX/raster/preview buffers + palette) is
  the next meatier editor candidate, but it's mostly atom-graph wiring with many
  reads — lower purity payoff; assess before extracting.
- Raster's `raster-preview.ts` (205 LOC, mostly processor/lib delegation) still
  available as a low-payoff option.

## Decisions taken
- **One use-case for both paints.** They shared bounds + EGX-limit + edit +
  history logic; unifying removes the duplication (jscpd dropped). The two
  differences are parameters: `expandLowResGroups` (single click expands the CPC
  group; drag paints raw pixels) and `entryType` (`'pixel'` vs `'region'`).
- **Per-target filtering preserves behavior.** The old single-paint returned the
  whole op on an out-of-bounds / EGX-limit failure; the old drag skipped
  per-pixel. Filtering each target independently yields the same result for a
  single click (its expanded targets are all on one line, all pass/fail
  together) and for a drag. Verified against the existing `editor-actions.spec`.
- **Clock port, like PR12.** The history timestamp (`Date.now()`) is the only
  impurity; wrapping it as `Clock` keeps the use-case deterministic and lets the
  spec assert exact timestamps.
- **Types own-then-re-export.** `export { type X } from '...'` does NOT bind a
  local name, and `editor-state.ts` uses `EditHistoryEntry` as a value-position
  generic (`atom<EditHistoryEntry[]>`). So it **imports** the types and
  separately **re-exports** them. (The plain `tsc --noEmit` missed this; the
  pre-commit `typecheck:comprehensive` / `tsconfig.app.json` caught it.)

## Guardrail status
- jscpd: **1.83% / 42 clones** — **improved** vs baseline 1.89% / 43 (the paint
  dedup removed a clone; the use-case copies nothing). No regression.
- knip: **24 unused files / 59 unused exports** — **flat** vs baseline. The old
  inline logic is gone (no orphan helpers); the new exports
  (`paintPixels`, `Clock`, the types) are all consumed. No regression.
- typecheck / tests: **pass**. `typecheck` + `typecheck:comprehensive` green.
  Full suite **2036 pass / 1 todo / 1 skipped**; new `paint-pixels.spec` 12/12;
  `editor-actions.spec` regression green. Biome clean on changed files (only the
  2 pre-existing CSS `!important` warnings remain repo-wide).
- Pre-existing, NOT introduced here: `pnpm check` fails on a forbidden
  `@radix-ui/react-tabs` import in `settings-panel.tsx` (present in HEAD; the
  pre-commit hook does not run that guard, so the commit passed).

## State to resume from
- Branch: `refactor/pr0-guardrails` · committed? **yes** (`e63aecc`; report
  committed separately by `/session-report`; untracked `CLAUDE.md` unrelated).
- Next action: continue **editor** — assess `enterEditModeAtom` for extraction
  (async, captures buffers/palette/EGX), or pick a smaller editor target.
  Otherwise raster's `raster-preview.ts` (low payoff). Run `/extract-use-case`.
- Watch out for: `paintPixels` is **synchronous + total** — call it directly,
  check `result.changed`, don't `await`. It needs the `Clock` port
  (`{ clock: systemClock }`). The editor domain types are owned by
  `@/editor/application/types` and **re-exported** by `editor-state.ts` — import
  from the store path or barrel as before; don't reach into the store for the
  type from the application layer.
