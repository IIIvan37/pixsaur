# Refactor — STATUS (canonical resume point)

**Read this first when resuming in a new session.** It always reflects the
current state. History lives in `docs/refactor/sessions/` (append-only).

Effort: incremental strangler-fig toward **use-cases + light ports** (NOT a
rewrite). Jotai/React become thin adapters over pure use-cases. Rationale &
big picture: `src/export/application/README.md` and the memory note
`refactor-clean-archi-plan`.

## Where we are

- **Branch:** `refactor/pr0-guardrails`
- **Current step:** PR15 (`renderRasterPreview` use-case, pure / sync / total,
  `RasterRenderer` port) — DONE (`820d85b`). Report:
  `sessions/2026-06-11-pr15-render-raster-preview.md`. Unified the two duplicated
  render branches of `rasterPreviewImageAtom` (optimized raster buffer vs
  standard preview buffer) into one use-case: validate buffer dims vs mode config
  (stale → `null`), render via nullable `RasterRenderer` port (GPU) with CPU
  fallback (`createRasterPreviewImageData`), always copy GPU output into a fresh
  `ImageData`. Atom is now a thin adapter (guards + buffer choice + atom reads);
  verbose `[RASTER]` logs dropped. `effectivePreviewImageAtom` (pure priority
  selector) left as-is.
- **Prev step:** PR14 (`enterEditMode` use-case, pure / sync / total / no
  port) — DONE (`d07c6fb`). Report:
  `sessions/2026-06-11-pr14-enter-edit-mode.md`. Extracted the state-derivation
  buried in async `enterEditModeAtom` (base-buffer fallback, EGX capture,
  aspect-ratio pixel mode, defensive copies); atom became a thin adapter.
- **Rebased onto `origin/main` (`e169299`, #327 mode0 horizontal downscale)** —
  the branch now sits on top of current main (0 behind / 13 ahead). All 13
  refactor SHAs were rewritten by the rebase; **see `git log` for current
  hashes** (the branch has never been pushed). Two conflicts resolved by folding
  #327's new `resampleStrategy` logic INTO the extracted use-cases:
  `normalizeImage` and `smoothImage` now take a `resampleStrategy` input and
  apply the linear-resample / skip-second-blur rule (the atoms forward
  `resampleStrategyAtom`). Verified: typecheck + targeted specs (71) + full
  suite green.
- **Next step:** strangler-fig extraction is **complete** — `raster-preview.ts`
  (the last reasonable candidate) is done. All five pivots (export, preview,
  palette, raster, editor) are seeded with their main orchestrations extracted.
  EGX / Mode-R / DSK store atoms are lib-delegation plumbing — skip. Next
  session: either (a) push the branch / open the PR (never pushed, 15 ahead), or
  (b) resolve the known real duplication `validate-custom-dimensions.ts`
  (identical in `src/preview/` and `src/source/`).

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
| — | All five pivots extracted. Strangler-fig complete. EGX / Mode-R / DSK = lib-delegation plumbing, skip. Open follow-ups: push/PR; dedup `validate-custom-dimensions.ts`. | ⬜ optional |

## Guardrail baseline (ratchet — must not regress)

Detectors are **report-only** (not in blocking `pnpm check`). Run
`pnpm refactor:preflight`. Numbers below are the high-water mark to drive down.

- jscpd: **1.82% duplication, 42 clones** (flat 2026-06-11, PR15)
- knip: **24 unused files, 59 unused exports** (flat 2026-06-11, PR15)
- Known real duplication to resolve later: `validate-custom-dimensions.ts`
  identical in `src/preview/` and `src/source/`.

## How to resume (checklist)

1. Read this file, then the latest report in `docs/refactor/sessions/`.
2. `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"` (WSL PATH quirk).
3. `git branch --show-current` and `git status` to confirm state.
4. For a use-case extraction, run the `/extract-use-case` skill.
5. End the session with the `/session-report` skill (updates this file +
   appends a dated report).
