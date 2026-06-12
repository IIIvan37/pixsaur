# Refactor — STATUS (canonical resume point)

**Read this first when resuming in a new session.** It always reflects the
current state. History lives in `docs/refactor/sessions/` (append-only).

Effort: incremental strangler-fig toward **use-cases + light ports** (NOT a
rewrite). Jotai/React become thin adapters over pure use-cases. Rationale &
big picture: `src/export/application/README.md` and the memory note
`refactor-clean-archi-plan`.

## Where we are

- **Branch:** `refactor/pr0-guardrails` — committed (`a30e69c`), **ahead of
  origin by 4 (unpushed)**.
- **Current step:** backlog #3 — deps cleanup — DONE (`a30e69c`). Report:
  `sessions/2026-06-12-deps-cleanup.md`. Dropped 11 dead deps (knip-verified):
  `marked`, `@lingui/macro` (v5 uses `@lingui/{core,react}/macro` subpaths),
  `lodash`+`@types/lodash` (inlined a minimal trailing debounce in
  `use-image-adjustement.tsx`), `@happy-dom/global-registrator`, `bun-types`,
  `add`, `autoprefixer`, `postcss`, `lint-staged`. Pinned `@types/bun`
  `latest`→`^1.2.13`. Documented script-only false positives in `knip.json`
  `ignoreDependencies` (canvas/chalk/jpeg-js/pngjs/sharp/why-did-you-render).
  knip deps now 1 (`@netlify/functions`, intentional infra placeholder). Full
  suite green (2051 passed), typecheck clean, jscpd unchanged (39/1.62%).
- **Prev step:** backlog #2 — dedup duplicated canvas `draw()` in
  `image-preview.tsx` — DONE (`2199a36`). Report:
  `sessions/2026-06-12-dedup-image-preview-draw.md`. Collapsed the `draw`
  callback + identical inline effect to one effect (−36/+2); jscpd 40→39.
- **Prev step:** backlog #1 — stabilize load-flaky specs — DONE
  (`c2f2364`). Report: `sessions/2026-06-12-stabilize-load-flaky-specs.md`.
  Raised `testTimeout`/`hookTimeout` 5s → 15s in `vitest.config.ts` (a timeout
  is a hang-detector; 5s is too tight for happy-dom render + one-time WASM
  transform under full-suite WSL contention) and dropped the redundant
  `vi.resetModules()` from `export-cpc-playground.spec.ts`. Full suite green
  (2051 passed), typecheck clean, guardrails at baseline.
- **Prev step:** strict full-codebase review + Radix guard fix — DONE
  (`f221c3f`). Report: `sessions/2026-06-12-strict-review-radix-guard.md`.
  Review verdict: typecheck clean, suite green, guardrails at baseline, all 13
  use-cases pure + spec-covered, correctness review of the 16-commit diff found
  no functional bug. Fixed the long-standing `pnpm check` failure (Radix guard,
  red since `d1c35d4` on main): new `src/components/ui/tabs/` wrapper,
  `settings-panel.tsx` rewired, `icon` typed `IconName`.
- **Prev steps:** PR15 `renderRasterPreview` (`820d85b`), PR14 `enterEditMode`
  (`d07c6fb`) — see their session reports. Strangler-fig extraction is
  **complete**: all five pivots (export, preview, palette, raster, editor)
  extracted; rebased onto `origin/main` (#327 `resampleStrategy` folded into
  `normalizeImage`/`smoothImage`).
- **Next step:** burn down the **review backlog** (one item per session, same
  flow as the PR steps — session report + STATUS update each time):
  1. ~~Stabilize load-flaky specs (`export-cpc-playground`, `raster-settings`).~~
     ✅ done (`c2f2364`): global 15s test timeout + dropped redundant
     `resetModules`.
  2. ~~Dedup the duplicated canvas `draw()` in `image-preview.tsx:40-116`
     (paints twice per preview change).~~ ✅ done (`2199a36`): collapsed the
     `draw` callback + identical inline effect to one effect.
  3. ~~Deps cleanup: drop `marked`, replace lone `lodash/debounce`, pin
     `@types/bun`, review knip's `@lingui/macro` + devDeps flags.~~ ✅ done
     (`a30e69c`): dropped 11 dead deps, inlined debounce, pinned `@types/bun`;
     knip deps 15→1 (`@netlify/functions` kept as infra placeholder).
  4. Specs for `src/domain/` (9 files, 0 specs) and `src/raster/`. ⟵ **next**
  5. Optional extractions (atoms that DO hold real logic despite the earlier
     "skip EGX/Mode-R" call): `mode-r-image.ts:33-210`,
     `egx-palette.ts:56-119`, `egx-image.ts:50-138`.
  6. Minor: popup `innerHTML` (`image-preview.tsx:165`), 2 Biome `!important`
     warnings, `setTimeout(…, 0)` workarounds in `editor-canvas.tsx`.

## What PR5 landed (quantize)

`src/preview/application/` seeded (first preview use-case, mirrors
`src/export/application/`):

- **Port** `PaletteQuantizer = Pick<ImageProcessor, 'quantizePalette'>` in
  `ports.ts`; runtime adapter is `imageProcessorAtom`, injected as
  `deps.quantizer`.
- **Use-case** `quantizePalette(input, deps) => Promise<Result>` in
  `quantize-palette.ts` (+ spec). One pass yields both `rawPalette` and
  `rgbPalette` (hw-quantized copy, truncated to `nColors - lockedEmptyCount`).
- **Rewire + old path deleted:** `quantization.ts` now has a private
  `quantizedPaletteAtom` thin adapter; `reducedPaletteRaw/RgbAtom` are selectors.
  Inlined `quantifyCPC{Classic,Plus}WithLocked` + locked-vec map removed —
  reused `@/domain/cpc` (`quantizeColorForHardware`, `quantizeArrayForHardware`,
  `truncatePalette`). Verbose `logger.info` dropped.

## Roadmap

Pilot feature = **Export** (`src/export`). Pattern proven here is replayed on
quantize, then the preview pipeline.

| PR | Scope | Status |
|----|-------|--------|
| PR0 | Guardrails: knip + jscpd (report-only), skills, registry, this doc | ✅ done (`a743503`) |
| PR1 | Export `PlaygroundPort` + adapters + kill Tauri leak (`FileSink`/`CanvasFactory` deferred to PR2) | ✅ done (`e177a53`) |
| PR2 | `exportImageToZip` use-case (extract `handleExport`) + `FileSink`/`CanvasFactory` ports + tests | ✅ done (`d9c01cb`) |
| PR3 | `openImageInPlayground` use-case (extract `handleOpenInPlayground`) + `PlaygroundExporter` port + tests | ✅ done (`273dafd`) |
| PR4 | `useExportActions` hook → `export-panel.tsx` becomes thin UI | ✅ done (`9bb16ae`) |
| PR5 | `quantizePalette` use-case + `PaletteQuantizer` port (extract `reducedPaletteRaw`/`reducedPaletteRgb` atoms) | ✅ done (`0e94df6`) |
| PR6 | `ditherImage` use-case + `ImageDitherer` port (extract `previewImageAtom`); dedup ignored-slot prep in `index-buffer.ts` | ✅ done (`5c6f550`) |
| PR7 | `buildIndexBuffer` use-case (pure, no port; extract `previewIndexBufferAtom`); `IndexBuffer` type owned by application layer, `IndexBufferData` aliased | ✅ done (`e22fe11`) |
| PR8 | `renderIndexBufferToImageData` use-case (pure, no port, total → `ImageData`; extract `finalPreviewImageAtom`) | ✅ done (`213712e`) |
| PR9 | `normalizeImage` + `positionNormalizedImage` use-cases (pure, no port, total → `ImageData \| null`; extract `normalizedImageAtom` / `positionedNormalizedImageAtom`) | ✅ done |
| PR10 | `smoothImage` use-case (pure, sync, no port, total → `ImageData \| null`; extract `smoothedImageAtom` in `image-pipeline.ts`) | ✅ done |
| PR11 | `reducePalette` use-case (pure, sync, no port, total → `PaletteSlot[]`; extract `setReducedPaletteAtom`); dedup store helpers/type onto `@/domain/cpc` | ✅ done |
| PR12 | `optimizeRaster` use-case (pure, sync, total, `IdGenerator` port; extract `autoOptimizeRasterAtom`); seeds `src/raster/application/` | ✅ done |
| PR13 | `paintPixels` use-case (pure, sync, total, `Clock` port; unify+extract `paintPixelAtom`+`paintPixelsAtom`, dedup history mgmt); seeds `src/editor/application/` | ✅ done (`e63aecc`) |
| PR14 | `enterEditMode` use-case (pure, sync, total, no port; extract state-derivation from async `enterEditModeAtom` — base-buffer fallback, EGX capture, pixel mode, copies) | ✅ done (`d07c6fb`) |
| PR15 | `renderRasterPreview` use-case (pure, sync, total, `RasterRenderer` port; unify the two duplicated render branches of `rasterPreviewImageAtom`) | ✅ done (`820d85b`) |
| — | All five pivots extracted. Strangler-fig complete. EGX / Mode-R / DSK = lib-delegation plumbing, skip. Open follow-ups: push/PR. | ✅ done (pushed) |
| — | Dead-file sweep: deleted 23 unused files (knip files 23→0); deduped `validate-custom-dimensions.ts`. | ✅ done (`5ba1e97`, `c8a3e8b`) |
| — | Strict review of full codebase + fix Radix-guard violation (`ui/tabs` wrapper). Review backlog recorded in "Where we are". | ✅ done (`f221c3f`) |
| — | Backlog #1: stabilize load-flaky specs — global 15s `testTimeout`/`hookTimeout`, dropped redundant `resetModules` in `export-cpc-playground.spec`. | ✅ done (`c2f2364`) |
| — | Backlog #2: dedup duplicated canvas `draw()` in `image-preview.tsx` (double paint) — collapse callback + identical inline effect to one effect. | ✅ done (`2199a36`) |
| — | Backlog #3: deps cleanup — drop 11 dead deps (marked, @lingui/macro, lodash, @happy-dom/global-registrator, bun-types, add, autoprefixer, postcss, lint-staged, @types/lodash), inline debounce, pin @types/bun; knip deps 15→1. | ✅ done (`a30e69c`) |

## Guardrail baseline (ratchet — must not regress)

Detectors are **report-only** (not in blocking `pnpm check`). Run
`pnpm refactor:preflight`. Numbers below are the high-water mark to drive down.

- jscpd: **1.62% duplication, 39 clones** (lowered 2026-06-12, image-preview
  draw dedup removed the lone tsx clone)
- knip: **0 unused files, 59 unused exports, 19 unused types, 1 unused dep**
  (files 23→0 2026-06-11, `5ba1e97`: deleted dead barrels + orphan modules;
  deps 15→1 2026-06-12, `a30e69c`: dropped 11 dead deps — the lone remaining
  `@netlify/functions` is an intentional Netlify infra placeholder)
- ~~Known real duplication: `validate-custom-dimensions.ts` in `src/preview/` +
  `src/source/`~~ — resolved 2026-06-11 (`c8a3e8b`): deleted the orphan
  `src/source/` copy (imported by nobody; the source barrel already defers to
  preview).
- **Remaining knip surface (deferred, per-symbol grind):** 59 unused exports +
  19 unused types — mostly never-wired setter atoms (`config/egx.ts` ×7,
  `config/mode-r.ts` ×6), unused convolution kernels (×7), and lib/domain helpers
  (`pixsaur-*`, `domain/cpc`). Deleting lib/domain exports **narrows public API** —
  do deliberately, not blanket. Investigated 2026-06-11.
- **Remaining jscpd (mostly intrinsic):** ~30 of 40 clones are *intra-file*
  algorithmic repetition in EGX / Mode-R / quant / map (mode 0/1/2 branches,
  dithering variants) — risky to DRY, low payoff. Real cross-file candidate left:
  `export-zip.ts` ↔ `export-cpc-playground.ts` (~51 lines).

## How to resume (checklist)

1. Read this file, then the latest report in `docs/refactor/sessions/`.
2. `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"` (WSL PATH quirk).
3. `git branch --show-current` and `git status` to confirm state.
4. For a use-case extraction, run the `/extract-use-case` skill.
5. End the session with the `/session-report` skill (updates this file +
   appends a dated report).
