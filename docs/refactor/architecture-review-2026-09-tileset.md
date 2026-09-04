# Architecture review — September 2026 · tileset workshop

**Date**: 2026-09-04 · **Base**: `feat/tileset-workshop` @ `5a1633a` ·
**Scope**: the tileset workshop — `src/tileset/`, `src/libs/pixsaur-tileset/`,
`src/app/store/tileset/`, `src/app/components/tileset-workshop/`.

Scope was taken from the commit history: the last 40 commits are almost entirely
those four directories. The image side was reviewed in
[`architecture-review-2026-08.md`](./architecture-review-2026-08.md) and its four
waves are applied — not revisited here.

Vocabulary is the deep-module one, same as the August review: **module**
(interface + implementation), **interface** (everything a caller must know —
types, invariants, ordering constraints, error modes), **depth** (leverage per
unit of interface), **seam**, **adapter**, **leverage**, **locality**. The
**deletion test**: imagine deleting the module — does complexity vanish
(pass-through) or reappear across N callers (earning its keep)? And: *one adapter
means a hypothetical seam, two means a real one.*

The settled decisions of this feature live in
[`../features/PLAN-tileset-workshop.md`](../features/PLAN-tileset-workshop.md)
(35 decisions, Q1–Q35, plus seven "conséquences forcées"). This review does not
re-litigate them, with one exception recorded below.

## Summary

| # | Candidate | Strength |
| --- | --- | --- |
| 1 | [Move the palette decisions out of the write functions](#1--move-the-palette-decisions-out-of-the-write-functions) | **Strong** |
| 2 | [Give the pen tables a module of their own](#2--give-the-pen-tables-a-module-of-their-own) | **Strong** |
| 3 | [Delete the PNG encoder, draw on a canvas](#3--delete-the-png-encoder-draw-on-a-canvas) | **Strong** — top |
| 4 | [Route the file exports through the FileSink port](#4--route-the-file-exports-through-the-filesink-port) | **Strong** |
| 5 | [Name the pen space](#5--name-the-pen-space) | Worth exploring |
| 6 | [Assemble the conversion input once](#6--assemble-the-conversion-input-once) | Worth exploring |
| 7 | [Collapse the grid-suggestion chain](#7--collapse-the-grid-suggestion-chain) | Worth exploring |
| 8 | [Share the workshop chrome, not the state](#8--share-the-workshop-chrome-not-the-state) | Speculative |
| 9 | [Declare what a palette strategy owes its caller](#9--declare-what-a-palette-strategy-owes-its-caller) | Worth exploring |

## Decisions already taken during the review

- **Q20 reopened, 2026-09-04 — the PNG goes truecolor.** Recorded in the PLAN
  (`Où on en est`, the `Sortie` decision, and the v2 backlog). The consumer is
  `img2cpc`, which snaps every colour to the nearest CPC one, so indexed colour
  buys nothing it asks for. This turns candidate 3 from a reshaping into a
  deletion and promotes it to the top. **Decision only — no code deleted yet.**
- Candidate 9 was added after the fix `d89d2d9`, which is its evidence.

---

## 1 · Move the palette decisions out of the write functions

**Strength**: Strong · **Dependency category**: in-process

**Files**: `src/app/store/tileset/palette.ts:28-30, :38-54, :67-93, :96-118` ·
`src/app/store/tileset/conversion.ts:42-55` ·
`src/app/store/tileset/edits.ts:125-141` ·
`src/app/store/tileset/config.ts:53-59` ·
`src/tileset/application/convert-tileset.ts:414-431, :482-487` ·
`src/app/components/tileset-workshop/tileset-palette-panel.tsx:46, :121, :141`

**Problem**. Three business rules each have two or three implementations, and
none of them lives in a module:

| Rule | Implementations |
| --- | --- |
| Pen budget (`nColors − reservedPens`) | `palette.ts:28-30` and `convert-tileset.ts:482-487` |
| Lock / reserved / hole validity | `palette.ts:51-53` and `checkLockedPens` at `convert-tileset.ts:414-431` |
| Transparency default (`pen` in mode 0, else `flatten`) | `convert-tileset.ts:99-103` and `tileset-palette-panel.tsx:46, :121` |

Six decisions live in Jotai write functions: `setTilesetPen` (a three-branch
decision with a budget guard), `toggleTilesetPenLock`, `freezeTilesetPalette` /
`thawTilesetPalette`, `setTileDither` (the Q18 fan-out to every instance of a
deduped tile), `tilesetPaletteSlots`, and the mode-change invalidation at
`config.ts:53-59`.

The store copy of `penBudget` exists only so the panel can refuse an edit the
use-case would refuse anyway (comment at `palette.ts:72-74`) — the two can drift
and nothing compares them.

**Solution**. Extract the six as pure functions in `src/tileset/application/`;
the atoms keep only the read and the write. This is the shape ADR-001 already
asks for, and the `extract-use-case` skill is the recipe.

**Wins**. Locality: one pen budget, not three. The interface becomes the test
surface. Roughly 60 % of `palette.spec.ts` and `edits.spec.ts` stop running a
real `convertTileset` plus a real PNG encode through `storeWithSheet()` /
`painted()` to assert a pure decision. Leverage: the use-case and the store share
one implementation.

The genuinely store-shaped assertions worth keeping as store tests are the
edit-layer invalidation edges (`edits.spec.ts:110-140`) and the capture/restore
round-trip (`project.spec.ts:127-133`) — those are about wiring.

---

## 2 · Give the pen tables a module of their own

**Strength**: Strong · **Dependency category**: in-process

**Files**: `src/tileset/application/convert-tileset.ts` — `nearestPens:528-549` ·
`penDistances:556-569` · `penMix:634-660` · `ratioBetween:663-672` ·
`diffusionColours:675-700` · `snapToHardware:345-374` · `blender:707-724`

**Problem**. `convert-tileset.ts` is 724 lines: 112 of orchestration, 151 of type
declarations, and 405 of private helpers. Most of those 405 are not glue — they
are ~268 lines of pure, tile-shaped colour maths that exist to satisfy the
`PenMix` and `DiffusionColours` interfaces of `ordered-dither.ts` and
`diffuse-tile.ts`. None of it is reachable from a test except through
`convertTileset(input)`.

Inside that block, the argmin-over-`chosen` loop is written out three times,
structurally identical (`:535-546`, `:647-654`, `:689-697`), and the four-line
snap-to-hardware twice (`:364-369`, `:718-722`).

What that costs in coverage: `penMix` / `ratioBetween` are reached only via
`dither: 'ordered'` on one fixture and asserted as "uses 2 pens", never as "mixes
at ratio r"; `blender` only via `antiAlias: true` on the staircase fixture,
asserted as "pen 2 appears"; `penDistances` only through
`collisions[0].error > 0`.

**Solution**. Lift the pen lookup tables into
`src/libs/pixsaur-tileset/src/pen-tables.ts`, next to the ditherers they serve.
Keep `snapToHardware` and `blender` in the application layer — `src/libs/**` must
not know CPC hardware — but as one module rather than two functions 350 lines
apart.

**Wins**. The mix ratio becomes assertable. One argmin, not three. The use-case
drops to orchestration. Locality: the colour maths sits in one file.

Pairs naturally with candidate 5 — do them in one pass.

---

## 3 · Delete the PNG encoder, draw on a canvas

**Strength**: Strong · **Dependency category**: ports & adapters ·
**Reopens Q20** (already recorded in the PLAN)

**Files**: `src/libs/pixsaur-png/**` (238 lines, deleted) ·
`src/tileset/application/render-tileset-png.ts` ·
`src/tileset/application/convert-tileset.ts:195-205, :311-316` ·
`src/app/store/tileset/edits.ts:39-61` ·
`src/app/components/tileset-workshop/tileset-result-panel.tsx:29-47` ·
`src/export/application/ports.ts:54` (the `CanvasFactory` port, already exists) ·
`src/components/image-preview/image-preview.tsx:98-107` (the shape to copy)

**Problem**. A hand-written indexed-PNG encoder produces a colour type nobody
downstream asked for, and its output doubles as the on-screen preview.

The deletion test, applied to `pixsaur-png`:

| | |
| --- | --- |
| What it claimed to buy | Pen indices in `PLTE`, a hole in `tRNS`, and determinism — "la garantie sur laquelle repose toute la tranche" |
| What it actually buys | Nothing reads a PNG back — there is no decoder in the repo. Dedup runs on tile indices at `convert-tileset.ts:286`, upstream of any encoding, so the encoder carries no part of that guarantee. RGBA alpha 0 replaces `tRNS`. |
| What deleting it costs | Complexity vanishes, it does not move: 238 lines gone, the "real deflate" v2 debt closed, output drops from ~66 KB of stored zlib blocks to a browser-deflated PNG |

The preview is the duplicated part. The image workshop draws with `putImageData`
and encodes nothing to look at the screen (`image-preview.tsx:98-107`); the
tileset workshop routes its preview through a blob URL (`usePngUrl`), so every
painted pixel encodes the sheet **twice** — once inside `convertTileset` at
`:311`, once in `editedTilesetAtom` at `edits.ts:54`, the first discarded.

**Solution**. Delete `pixsaur-png`. Draw the sheet into a canvas for the view;
call `toBlob` through the existing `CanvasFactory` port on export.
`convertTileset` returns `ConvertedTileset` alone.

**Wins**. A module deleted, not moved. Zero encoding per stroke. The spec stops
decoding PNG headers at byte 16 to assert that gutters survived
(`convert-tileset.spec.ts:188, :229, :370`). Two adapters make the `CanvasFactory`
seam real.

**No caveat**: `img2cpc` snaps to the nearest CPC colour and every pen is already
an exact hardware colour out of `snapToHardware`, so the round-trip is the
identity. Q9 (pre-stretch) and Q10 (source grid preserved) are unchanged.

---

## 4 · Route the file exports through the FileSink port

**Strength**: Strong · **Dependency category**: ports & adapters

**Files**: `src/app/components/tileset-workshop/tileset-result-panel.tsx:103-116` ·
`src/app/components/tileset-workshop/tileset-project-actions.tsx:18-22, :39-50, :57-69` ·
`src/components/export-panel/use-export-actions.ts:145-148` (the shape to copy)

**Problem**. Two components resolve the `FileSink` adapter inside an `onClick`.
The PNG export — blob construction, the filename `'tileset.png'`,
`resolveFileSink()`, the error logging — lives entirely in JSX. So do the project
file's refusal map, its parse-then-restore decision, and its serialize-then-save.
There is no `export-tileset-png` use-case in `src/tileset/application/`.

Consequence for tests: those decisions can only be exercised by rendering a panel
and `vi.mock`-ing the file-sink module (`tileset-result-panel.spec.tsx:18`,
`tileset-project-actions.spec.tsx:21`).

The image workshop already does this correctly:
`exportImageToZip({…}, { canvasFactory, fileSink: resolveFileSink() })`.

**Solution**. Add `exportTilesetPng`, `exportTilesetProjectFile` and
`importTilesetProjectFile` to `src/tileset/application/`, taking the port as a
dependency.

**Wins**. Two adapters make the seam real. No `vi.mock` needed to test a
decision. The panels go back to rendering. Leverage: web and Tauri on one path.

Lands on the same port work as candidate 3 — sequence them together.

---

## 5 · Name the pen space

**Strength**: Worth exploring · **Dependency category**: in-process

**Files**: `src/tileset/application/convert-tileset.ts:152, :158, :161, :163-167,
:218, :244, :380-382, :390-406` ·
`src/libs/pixsaur-tileset/src/diffuse-tile.ts:29-30` ·
`src/libs/pixsaur-tileset/src/ordered-dither.ts:34-35` ·
`src/tileset/application/render-tileset-png.ts:60, :69-83`

**Problem**. One concept — "pen index 0 is the hole when transparency spends a
pen, and every other index shifts by one" — is spelled out in eleven places
across three files and two layers. `holePen = 0` is declared independently in two
lib modules and nothing enforces that they agree.

The offset travels as a bare `offset: number` through six signatures:
`nearestPens`, `penDistances`, `penMix`, `diffusionColours`,
`lockedByChosenIndex`, `checkLockedPens`. It is a single bit moving as a number.

Related: `{ ignore: HOLE }` is threaded through six call sites and typed as
`ignore?: number` in six different option interfaces (`AntiAliasOptions`,
`EdgeMaskOptions`, `DiffuseOptions`, `OrderedDitherOptions`, `HistogramOptions`,
`CollisionOptions`) — six identical two-line interfaces carrying the same doc
comment.

**Solution**. One `PenSpace` value holding `{ holePen, toChosen(i), toPalette(i),
isHole(i) }`. Callers ask it questions instead of doing arithmetic.

**Wins**. Six parameters disappear. The hole default stops being copied.
Locality: one place to get it wrong.

Do it in the same pass as candidate 2.

---

## 6 · Assemble the conversion input once

**Strength**: Worth exploring · **Dependency category**: in-process

**Files**: `src/app/store/tileset/conversion.ts:25-32` ·
`src/app/store/tileset/edits.ts:54-59` · `src/app/store/tileset/project.ts:26-36` ·
`src/tileset/application/convert-tileset.ts:56-66` vs
`src/libs/pixsaur-tileset/src/slice-sheet.ts:10-20`

**Problem**. The tuple `(source, target, mode, background)` is spelled out in
three unrelated files. There is no `tilesetConversionInputAtom` that the
conversion, the encode and the capture could all read.

Two concepts also carry two names: `TilesetSheet`
(`convert-tileset.ts:56-60`) is a field-for-field copy of `Sheet`
(`slice-sheet.ts:10-14`), and `TileSize` (`:63-66`) of `TileGrid` (`:17-20`).
They type-check against each other only because TypeScript is structural, and
both names are live in the same call chain: `geometry.ts:25` declares
`tilesetTargetAtom = atom<TileGrid>(...)` from the lib, `conversion.ts:28` feeds
it into `target: TileSize` from the application layer. A new field on one would
warn nobody.

Note also that the store imports from both `@/tileset` and
`@/libs/pixsaur-tileset` (`geometry.ts:9-18`), and that `SheetGrid` — an internal
lib type — is part of the persisted project file format
(`tileset-project.ts:177, :218`). The lib is a second public API of the feature.

**Solution**. One derived `tilesetConversionInputAtom`; drop the structural twins
in favour of the lib's `Sheet` and `TileGrid`.

**Wins**. A new field is added once. The twins stop drifting silently. Locality:
one assembly site.

Cheap once candidate 3 has removed the second assembly at `edits.ts:54`.

---

## 7 · Collapse the grid-suggestion chain

**Strength**: Worth exploring · **Dependency category**: in-process

**Files**: `src/tileset/application/suggest-tile-grid.ts:21, :31-39` ·
`src/libs/pixsaur-tileset/src/tile-geometry.ts:14-17, :29-52` ·
`src/libs/pixsaur-tileset/src/tile-dedup.ts:67-69` ·
`src/libs/pixsaur-tileset/index.ts:22`

**Problem**. Four shallow exports:

- `suggestTileGrid` — 4 statements. It supplies one default
  (`PLAUSIBLE_TILE_SIZES`) and does `sizes.map((size) => ({ ...blanks, ...size }))`.
  Its `GridBlanks` type is an `Omit` of a lib type. The chain
  `rankTileGrids ← suggestTileGrid ← tilesetGridSuggestionsAtom` is three modules
  for one sort, and `rankTileGrids` has exactly one caller.
- `idealTileHeight`, `idealTileWidth`, `aspectDistortion` — one expression each
  (`tile-geometry.ts:34, :43, :51`), built on a `TileShape` wrapper type that
  exists only to bundle two others, all three called back-to-back by the same
  single caller (`suggest-tile-geometry.ts:51, :55, :56`).
- `duplicateRate` — three lines, exported through the barrel, called only from
  `rank-grids.ts:76` inside the same lib.
- `bayerThresholds` — real code, exported from the barrel, **zero callers**
  outside its own module and spec. Invisible to knip because `knip.json` sets
  `ignoreExportsUsedInFile: true`; the ratchet will not catch this family.

**Solution**. Fold the default into `rankTileGrids`, inline the three formulas
into `suggestTileGeometry` (whose whole body is 12 lines), drop `duplicateRate`
and `bayerThresholds` from the barrel.

**Wins**. The barrel shrinks by six exports. One hop, not three. `TileShape`
deleted. Deletion test: complexity shrinks.

**Keep**: `candidateTileSizes` (36 lines with a real sort and tie-break) earns
its export.

---

## 8 · Share the workshop chrome, not the state

**Strength**: Speculative · **Dependency category**: in-process

**Files**: `src/app/store/tileset/use-tileset-persistence.ts:12, :34-54` ↔
`src/app/store/session/use-session-persistence.ts:11, :24-40` ·
`src/app/store/tileset/project.ts:22-59` ↔ `src/app/store/session/session.ts:46-125` ·
`src/app/components/tileset-workshop/tileset-workshop.tsx:27-52` ↔
`src/app/components/main-content/main-content.tsx:9-35` ·
`tileset-info-bar.tsx` ↔ `src/components/info-bar/info-bar.tsx` ·
`src/app/store/tileset/edits.ts:31` ↔ `src/app/store/editor/editor-actions.ts:69`

**Problem**. Eleven pieces of workshop machinery were copied from the image side
rather than shared. The clearest:

- Two independent implementations of the same debounced-persistence algorithm,
  both declaring `PERSIST_DEBOUNCE_MS = 800`. The tileset one is the better
  version — it takes the store as a port parameter and tracks hydration in state.
- `const systemClock: Clock = { now: () => Date.now() }` written twice, both
  importing `Clock` from the same `@/editor/application/ports`.
- The same workshop layout skeleton with two stylesheets
  (`.actions/.workspace/.column` against
  `.settingsButtonContainer/.flexRow/.flexColumnGrow`).
- Two info bars with two CSS blocks for the same markup idiom.
- The `<div class=field><span class=label/><Select/></div>` triad appears **7
  times** across `tileset-palette-panel.tsx`, `tileset-render-panel.tsx` and
  `tileset-geometry-panel.tsx`; the candidate-list block twice
  (`tileset-grid-panel.tsx:59-90` ↔ `tileset-geometry-panel.tsx:99-121`).

Properly reused already: `SettingsDock`, `ColorPaletteView`, the `PaletteSlot`
type.

**Solution**. Share the mechanism, not the state: a
`useDebouncedPersistence(capture, restore, store)` hook, a `WorkshopLayout`, one
`InfoBar`, one `systemClock`, a `LabelledSelect`, a `CandidateList`.

**Does not reopen Q6 · Q32 · Q34.** That decision is about *state* — two open
documents, two atom spaces. Sharing the layout, the debounce and the clock leaves
it intact; merging `cpcMode` or the capture atoms would not.

**Wins**. One debounce, two workshops. Two CSS blocks become one. Leverage across
both workshops. Lowest risk, lowest payoff of the nine.

---

## 9 · Declare what a palette strategy owes its caller

**Strength**: Worth exploring · **Dependency category**: in-process

**Files**: `src/libs/pixsaur-color/src/quant/palette-strategies-v2.ts:122-127`
(the interface) · `:1412-1418` (`combinatorialCap`), `:1494`, `:1684`, `:1888` ·
`…spec.ts:2336-2344` (the sweep) ·
`src/tileset/application/convert-tileset.ts:517-520` (the consumer)

**Problem**. The fix `d89d2d9` is the evidence for this card. Three combinatorial
strategies capped their candidates at 12–16 to bound the search; a mode 0 tileset
asks for 15 pens, so `kCombinationsV2(n, k)` with `k > n` produced nothing, the
strategy returned an empty palette, and `convertTileset` dereferenced it.

`PaletteStrategyFunction` takes `targetColors` and says nothing about what comes
back. Fifteen implementations each decide; roughly twenty files consume the
result. The consumer at `convert-tileset.ts:517-520` slices and trusts.

**Already landed in `d89d2d9`**: `combinatorialCap` at the three offending sites,
plus a sweep over `AVAILABLE_STRATEGIES` asserting that no strategy returns an
empty palette. That is the half that protects.

**Solution**. State the postcondition on `PaletteStrategyFunction` — the
interface is more than the type signature, and this fact belongs in it — and
strengthen the sweep from "not empty" to the declared length, presumably
`min(targetColors, candidates.length)`. Whether all fifteen already honour it is
what the sweep would tell you.

**Wins**. Leverage: fifteen implementations, one contract. A sixteenth strategy
inherits the guard. ~20 consumers stop guessing. Locality: the cap rule has one
home.

---

## Found in passing

Not deepening opportunities. Cheap, and each is a green signal covering code that
never ran.

- **`convert-tileset.ts:224`** — `grid-mismatch` is one of five documented error
  modes and the only one with no test.
- **`convert-tileset.ts:464, :475-479`** — `placeLockedPens` never fires its
  cursor-fill loop, so the behaviour documented at `:448-453` ("a position the
  sheet left unfilled below a pin is painted the background") is unverified.
  Reaching it needs a pin high in the budget over a sheet poorer in colours than
  the pin index — e.g. mode 0, `lockedPens: { 15: WHITE }`, a two-colour sheet.
  The four existing locked-pen tests (`spec:427-490`) all pin at index 1 or 3
  with 3–4 colour sheets, which never leaves a gap.
- **`convert-tileset.ts:329`** — the `sheetEdges` majority tie-break
  (`* 2 >= verdicts.length`) is never asserted; every fixture is decisively wrap
  or clamp.
- **No `src/tileset/application/README.md`.** Every other feature has one
  (`export`, `preview`, `palette`, `raster`, `editor`) and it is where the port
  and use-case registry lives. The tileset registry exists only inside the PLAN.
- **The `TilesetProjectStore` port has one adapter and two independently written
  inline fakes** (`persist-tileset-project.spec.ts:27-34`,
  `use-tileset-persistence.spec.tsx:41-42`). A shared fake would make the second
  adapter real.

## Checked and healthy — leave alone

- **`resize-scheme.ts`** — 184 lines behind a 4-argument call, with the
  exhaustive/greedy/grown decision and the 200 000-candidate budget fully hidden.
  The deepest module in the feature. Its `greedy` and `grown` branches are
  covered at the lib level, which is an argument *for* the lib seam.
- **`convert-tileset.spec.ts`** — 564 lines, 43 tests, every one through the
  exported interface, no internal import, no `vi.mock`. Measured coverage of the
  use-case from this spec alone: 98.89 % statements, 95.83 % branch.
- **`tilesetOptionsAtom` as one bag** typed
  `Pick<ConvertTilesetInput, …>` — the panels, the use-case and the saved file
  cannot drift apart.
- **`edge-mask.ts`, `edge-condition.ts`, `resize-tile.ts`** — small, but each
  names a decision inlining would lose (tile-local sampling origin,
  seam-vs-internal-texture comparison, holes take no side). Shallow by size, deep
  by consequence.
- **`dedupeTiles`** — four call sites, the only real hub in the lib.

## Top recommendation

**[Candidate 3 — delete the PNG encoder, draw on a canvas](#3--delete-the-png-encoder-draw-on-a-canvas).**
It is the only candidate that *deletes* a module rather than reshaping one, and
the product question that held it back is answered: `img2cpc` wants the palette
and a truecolor PNG. 238 lines go, the per-stroke encoding goes with them, and
the export lands on the `CanvasFactory` port that already exists.

Then **[candidate 1](#1--move-the-palette-decisions-out-of-the-write-functions)**,
the only remaining correctness risk: the pen budget and the lock rule each have
two implementations that can drift, and nothing compares them.

## Suggested sequencing

| Wave | Candidates | Note |
| --- | --- | --- |
| 1 | 3 | Deletes `pixsaur-png`, removes the double encode, lands the `CanvasFactory` port |
| 2 | 4 | Same port work, independent of 3's internals |
| 3 | 9 | Finish the strategy contract; the protecting half shipped in `d89d2d9` |
| 4 | 1 | `extract-use-case` — the correctness risk |
| 5 | 6 | Cheap once 3 removed the second assembly site |
| 6 | 2 + 5 | Pen tables and pen space, one pass — `tdd-cycle`, pure core |
| 7 | 7, 8 | Barrel trim, then shared chrome |

Close every slice with `quality-gate`.

## How to resume this on another machine

Everything needed is in the repo. The review was produced as an HTML report in
the OS temp directory — that file is machine-local and disposable; this document
is the record.

1. Read this file, then
   [`../features/PLAN-tileset-workshop.md`](../features/PLAN-tileset-workshop.md)
   — it is the canonical resume point for the feature, and its "Où on en est"
   section carries the Q20 reversal.
2. Read [`ADR-001-file-layout.md`](./ADR-001-file-layout.md) for the layering
   rules any of these changes must respect.
3. Pick a candidate from the sequencing table. Slices touching the pure core
   (`src/libs/**`, `src/domain/**`) go through `tdd-cycle`; slices carving an
   existing atom or component into a use-case go through `extract-use-case`.
4. Nothing in this review has been implemented. The only change landed so far is
   the Q20 record in the PLAN (`5a1633a`).
