# Tileset — application layer (use-cases + ports)

Living registry for the tileset workshop. **Read this before adding a use-case
or a port** (`/extract-use-case` step 1) so you reuse what exists instead of
duplicating it. Keep it in sync when you land a change.

Target architecture: business orchestration lives in use-cases
`(input, deps) => Result`; impure side-effects arrive through ports; React
components and Jotai atoms are thin adapters that assemble the input, inject the
real ports, and map the result to UI.

The feature's design record is
[`docs/features/PLAN-tileset-workshop.md`](../../../docs/features/PLAN-tileset-workshop.md)
— the `Qnn` references in the source point at its decisions. The open
architecture candidates are in
[`docs/refactor/architecture-review-2026-09-tileset.md`](../../../docs/refactor/architecture-review-2026-09-tileset.md).

## Ports

| Port | Responsibility | Adapter | Status |
|------|----------------|---------|--------|
| `TilesetProjectStore` (`ports.ts`) | where the workshop's document sleeps between two visits (Q31) | `adapters/idb-project-store.ts` (IndexedDB — a sheet is far past what `localStorage` holds) | ✅ landed (T9) |

Two ports come from `src/export` — the seam is shared on purpose, and each has
a second consumer here:

| Port | Responsibility | Resolution |
|------|----------------|------------|
| `FileSink` | persist the file the user asked for | `resolveFileSink()` (web download vs Tauri save dialog) |
| `CanvasFactory` | create an offscreen canvas | `domCanvasFactory` — the webview serves desktop too |

## Use-cases

| Use-case | Input (summary) | Result | Ports used |
|----------|-----------------|--------|------------|
| `convertTileset` | sheet, source grid, target tile, mode, hardware, render options | `{ ok, tileset } \| { ok:false, error }` (5 named refusals) | none — pure, sync, total |
| `suggestTileGeometry` | source platform, mode, asked-for tile size | candidate tile sizes ranked by aspect distortion | none |
| `paintTileset` / `undoTilesetEdits` / `redoTilesetEdits` / `applyTilesetEdits` | edit layer + the pixels a stroke names | a new edit layer, or the converted tiles replayed | none |
| `renderTilesetSheet` | converted tileset + the source grid | RGBA pixels in the shape of a source sheet | none |
| `renderTileAtlas` | the pens, the tiles, a column count, target, mode | RGBA pixels, tiles edge to edge — what Tiled reads (M-Q20) | none |
| `saveTilesetSheet` | `{ sheet, filename? }` — defaults to `TILESET_SHEET_FILENAME` | `{ ok } \| { ok:false, error:'no-canvas-context' \| 'encode-failed' }` | `CanvasFactory`, `FileSink` |
| `exportTilesetTiled` | edited tileset, target, mode, hardware, `map?`, `filename?` — defaults to `TILED_ARCHIVE_FILENAME` | `{ ok } \| { ok:false, error:'no-canvas-context' \| 'encode-failed' }` — one ZIP holding the TSX and its PNG, plus the TMX when a map is given | `CanvasFactory`, `FileSink` |
| `mapTileset` | edited tileset, map options (budget, `emptyTile`) | the cells (`EMPTY_CELL` for the empty tile), the distinct tiles in order of first appearance, the grid, `overBudget`, `emptyTile` (M-Q7 · M-Q13 · M-Q18) | none |
| `inspectSheet` | the source sheet | `{ scale, filtered }` — the whole factor to undo, and whether the image carries more than `FILTERED_COLOURS` colours (M-Q19) | none |
| `suggestMapOffset` | the source sheet, the grid | the offset with the smallest share of unique tiles, or `null` when the grid already sits on it (M-Q4) | none |
| `loadTilesetProject` / `saveTilesetProject` | the store, the project | the project or `null` · `true` / `false` | `TilesetProjectStore` |
| `exportTilesetProjectFile` | `{ project, filename? }` — defaults to `TILESET_PROJECT_FILENAME` | `{ ok } \| { ok:false, error:'save-failed' }` | `FileSink` |
| `importTilesetProjectFile` | `{ file }` (the picked `Blob`) | `ParseTilesetProjectResult` + `'unreadable-file'` | none — a `Blob` is a value, a fake is one line |
| `tilesetPaletteSlots` / `dropPen` / `togglePenLock` / `freezePalette` / `thawPalette` / `setTileDither` (`tileset-options.ts`) | the mode, the options, and what the conversion produced | the options the panel should write — **unchanged, by reference, when the edit is refused** | none |

`pen-budget.ts` is not a use-case either: it is the arithmetic of Q16 · Q23 —
how many pens the mode holds, how many the sprites were promised, which pen the
holes take, and whether a given pen is the user's to pin. `convertTileset`, the
palette panel and `tileset-options.ts` all ask it rather than each doing the sum:
two answers disagreeing is a pin the panel accepts and the conversion refuses.

`encode-sheet-png.ts` is the one place a sheet becomes PNG bytes, through the
canvas. The two exports that carry a PNG share it. The ZIP comes from
`@/export/exports/zip-files`: `FileSink` saves one blob per call, and the files
of a Tiled export name each other by relative path.

`tileset-options.ts` is where the palette panel's decisions live. A refusal
comes back as the very object that was passed in, so the atom that calls one has
nothing left to decide — Jotai skips a write of the same reference.

`hardware-colours.ts` is the CPC colour space as the conversion works in it:
snapping a tile's pixels onto it, and blending two of its colours back into it.
It stays in the application layer because `src/libs/**` must not know what a CPC
is; the pen lookup tables built on top of it are the lib's `penTables`, which
takes the metric as a parameter and so knows nothing of the hardware.

`tileset-project.ts` is not a use-case: it is the document itself (Q31) — one
shape, two carriers. IndexedDB keeps the object as it is (the structured clone
carries the bytes); the exported file carries the same fields as JSON with the
bytes in base64. `parseTilesetProject` **names** what failed. A version 2
project is migrated to version 3 as a sheet, because that is its only reading
(M-Q21). A project from any other version is dropped, never migrated blind.

## What the panels may still do

Assemble the input from atoms, resolve the port for the runtime, call the
use-case, and turn the result into a message. Nothing else: a decision written
in JSX can only be tested by rendering a panel and `vi.mock`-ing a module.

Persistence is a convenience, never a condition — a store that is missing,
blocked or full loses the auto-save and the workshop opens anyway. The project
file is the durable copy the user controls.
