# Editor — application layer (use-cases + ports)

Living registry for the editor feature. **Read this before adding a use-case or
a port** (`/extract-use-case` step 1) so you reuse what exists instead of
duplicating it. Keep it in sync when you land a change.

Target architecture (same as `src/export/application/`,
`src/preview/application/`, `src/palette/application/` and
`src/raster/application/`): business orchestration lives in pure use-cases;
impure side-effects arrive through ports; Jotai atoms / React components are
thin adapters that assemble the input, inject the real ports, and map the
result to state.

## Domain types

Owned here (`types.ts`), re-exported by `app/store/editor/editor-state.ts` for
the store's many consumers (preview pipeline, barrels, specs):

- `PixelEdit` — one pixel mutation (`previousInkIndex` / `newInkIndex`).
- `EditHistoryEntry` — an undoable batch of edits (`'pixel' | 'region' | 'fill'`).
- `MAX_HISTORY_SIZE` — undo-history cap (100).

## Ports

| Port | Method | Runtime adapter | Used by |
|------|--------|-----------------|---------|
| `Clock` | `now(): number` | `systemClock` (`Date.now()`, in `editor-actions.ts`) | `paintPixels` |

## Use-cases

One row per extracted use-case.

| Use-case | Replaces | Input (summary) | Result | Ports used |
|----------|----------|-----------------|--------|------------|
| `paintPixels` ✅ | `paintPixelAtom` + `paintPixelsAtom` orchestration in `app/store/editor/editor-actions.ts` | `{ buffer, width, height, selectedInk, egxConfig, pixels, entryType, expandLowResGroups, history, historyIndex }` | `{ changed, buffer, edits, history, historyIndex }` (total) | `Clock` |

> Status: `paintPixels` is the first editor use-case (seeds the folder). A pure,
> **synchronous, total** function that unifies the single click and the drag
> stroke (the previous duplicated logic). For each target it optionally expands
> to the 2-wide CPC pixel group on EGX low-res lines
> (`expandLowResGroups`, single click only), then filters by bounds and the
> per-line EGX color limit (`getMaxColorIndex` / `getModeForLine`), writes into a
> **copy** of the buffer (input never mutated), and — when anything changed —
> appends a history entry (timestamped via the `Clock` port), truncating any
> redone future and capping at `MAX_HISTORY_SIZE`.
>
> **Total** — no `{ ok }` union: when nothing changes it returns
> `changed: false` with the original buffer/history. The atom adapters own the
> state reads (`editorIndexBufferAtom`, `editorDimensions/SelectedInk/Egx*`),
> the null guards, and the writes (`editorHistoryAtom`,
> `editorHistoryIndexAtom`, `editorIndexBufferAtom`). The verbose
> `logger.warn` on EGX-limit was dropped.
>
> Reuse over reinvention: EGX line math stays in `@/libs/pixsaur-egx`. The
> single-click `paintAtCursorAtom` still delegates to `paintPixelAtom`; undo /
> redo remain thin store atoms (they replay the `PixelEdit[]` of a history
> entry — no orchestration to extract).

## Notes

`EGXConfig` is owned by `@/libs/pixsaur-egx/types`. The use-case depends on the
lib type, never on a store-local copy.
