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
| `suggestTileGrid` | sheet, user margins | plausible grids ranked by tilemap cost | none |
| `paintTileset` / `undoTilesetEdits` / `redoTilesetEdits` / `applyTilesetEdits` | edit layer + the pixels a stroke names | a new edit layer, or the converted tiles replayed | none |
| `renderTilesetSheet` | converted tileset + the source grid | RGBA pixels in the shape of a source sheet | none |
| `saveTilesetSheet` | `{ sheet, filename? }` — defaults to `TILESET_SHEET_FILENAME` | `{ ok } \| { ok:false, error:'no-canvas-context' \| 'encode-failed' }` | `CanvasFactory`, `FileSink` |
| `loadTilesetProject` / `saveTilesetProject` | the store, the project | the project or `null` · `true` / `false` | `TilesetProjectStore` |
| `exportTilesetProjectFile` | `{ project, filename? }` — defaults to `TILESET_PROJECT_FILENAME` | `{ ok } \| { ok:false, error:'save-failed' }` | `FileSink` |
| `importTilesetProjectFile` | `{ file }` (the picked `Blob`) | `ParseTilesetProjectResult` + `'unreadable-file'` | none — a `Blob` is a value, a fake is one line |

`tileset-project.ts` is not a use-case: it is the document itself (Q31) — one
shape, two carriers. IndexedDB keeps the object as it is (the structured clone
carries the bytes); the exported file carries the same fields as JSON with the
bytes in base64. `parseTilesetProject` **names** what failed and a project from
another version is dropped, never migrated blind.

## What the panels may still do

Assemble the input from atoms, resolve the port for the runtime, call the
use-case, and turn the result into a message. Nothing else: a decision written
in JSX can only be tested by rendering a panel and `vi.mock`-ing a module.

Persistence is a convenience, never a condition — a store that is missing,
blocked or full loses the auto-save and the workshop opens anyway. The project
file is the durable copy the user controls.
