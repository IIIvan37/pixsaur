# Session report — 2026-06-12 — strict review + Radix guard fix

> Append-only history; the canonical current state lives in
> `docs/refactor/STATUS.md` (update it too).

## Goal of the session

Strict review of the whole codebase state (post strangler-fig), then start
burning down the findings — first one: the Radix import-guard violation.

## Done

- **Full strict review** (typecheck, full test suite ×2, `pnpm check`,
  knip/jscpd, architecture-conformance audit, correctness review of the
  16-commit diff vs main). Key results:
  - Typecheck clean; 2031/2032 tests pass; jscpd/knip exactly at baseline.
  - All 13 use-cases under `src/*/application/` are pure and 100% spec-covered.
  - Correctness review of the extracted use-cases vs the old atom code found
    **no functional bug** (defensive copies OK, `resampleStrategy` rebase
    resolution faithful to #327, the 23 deleted files were truly dead).
- **Fixed the `pnpm check` failure** (Radix guard, red since `d1c35d4` #254 on
  main): new wrapper `src/components/ui/tabs/` (re-exports `Tabs`, `TabsList`,
  `TabsTrigger`, `TabsContent` + smoke spec); `settings-panel.tsx` now consumes
  it. Bonus: `TabDefinition.icon` typed `IconName`, `as any` cast removed.
  Commit `f221c3f`, **pushed**. Pre-commit hook fully green again.

## Not done / remaining (review backlog — treat like the PR steps, one per session)

1. **Flaky tests under load (WSL)**: `export-cpc-playground.spec.ts`
   ("should return error when ASM source generation fails", ~700ms alone,
   RASM/WASM) and `raster-settings` specs hit the 5s timeout when the full
   suite runs under load; all pass in isolation. Fix: per-test timeout or mock
   the RASM module.
2. **Duplicated canvas draw** in
   `src/components/image-preview/image-preview.tsx:40-116`: a `useCallback
   draw` + a verbatim-duplicate `useEffect` both fire on the same deps — every
   preview change paints twice. Consolidate into one effect.
3. **Deps cleanup**: `marked` (zero imports), `lodash` (single
   `debounce` in `use-image-adjustement.tsx` → hand-rolled), `@types/bun:
   latest` (floating), knip also flags `@lingui/macro` + 13 devDeps.
4. **Missing specs**: `src/domain/` (9 files, 0 specs — CPC core) and
   `src/raster/` (0 specs); `src/app/store` ~32%.
5. **Optional extractions** (nuance vs the earlier "EGX/Mode-R = plumbing,
   skip" call — these atoms DO hold real logic):
   `mode-r-image.ts:33-210` (3 pure resize fns), `egx-palette.ts:56-119`
   (palette optimization), `egx-image.ts:50-138` (crop+resize orchestration).
6. **Minor**: `innerHTML` on popup window (`image-preview.tsx:165`, controlled
   content), 2 Biome `!important` warnings in `draggable-dialog.module.css`,
   4× `setTimeout(…, 0)` in `editor-canvas.tsx`.

## Decisions taken

- Review findings are tracked HERE + in STATUS (no separate issue tracker);
  burn them down one per session, same flow as the PR steps.
- Tabs wrapper = thin re-export of the 4 Radix primitives (shadcn-style), not
  an opinionated component — single consumer keeps its own CSS classes.

## Guardrail status

- jscpd: 1.71% / 40 clones (no regression)
- knip: 0 unused files / 59 exports / 19 types (no regression)
- typecheck / tests: pass (only the load-flaky tests above, all green isolated)
- `pnpm check`: **green again** (was failing on the Radix guard)

## State to resume from

- Branch: `refactor/pr0-guardrails`, in sync with origin · committed? y
  (`f221c3f` pushed)
- Next action: backlog item 1 — stabilize the load-flaky specs (timeout/mock).
- Watch out for: full-suite runs under WSL load can flake ANY 5s-timeout spec;
  always re-check failures in isolation before concluding. `CLAUDE.md` is
  untracked in the worktree — decide separately whether to commit it.
