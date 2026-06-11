# Preview — application layer (use-cases + ports)

Living registry for the preview feature. **Read this before adding a use-case or
a port** (`/extract-use-case` step 1) so you reuse what exists instead of
duplicating it. Keep it in sync when you land a change.

Target architecture (same as `src/export/application/`): business orchestration
lives in pure async use-cases `(input, deps) => Promise<Result>`; impure
side-effects arrive through ports; Jotai atoms / React components are thin
adapters that assemble the input, inject the real ports, and map the result to
state.

## Ports

Interfaces in `ports.ts`. Reuse one of these before defining a new port.

| Port | Responsibility | Runtime adapter | Status |
|------|----------------|-----------------|--------|
| `PaletteQuantizer` | quantize an image buffer to a CPC palette (narrow `Pick<ImageProcessor,'quantizePalette'>`) | the `imageProcessorAtom` value (`@/libs/pixsaur-adapter`, GPU + CPU fallback) | ✅ landed (PR5) |
| `ImageDitherer` | dither an image onto a reduced palette (narrow `Pick<ReturnType<typeof createQuantizer>,'dither'>`) | the `quantizerAtom` value (`app/store/preview/pipeline/quantization.ts`, `createQuantizer` from `@/libs/pixsaur-color`) | ✅ landed (PR6) |

> `PaletteQuantizer` is a facet of `ImageProcessor` — use-cases depend only on
> the one method they need. No web/desktop split: the same processor serves
> both (the desktop app runs in a webview); the atom injects the resolved
> processor directly as `deps.quantizer`.
>
> `ImageDitherer` is a facet of the per-image quantizer object returned by
> `createQuantizer` (a different thing from `ImageProcessor` — it owns the
> `dither` method). The atom injects the resolved `quantizerAtom` value as
> `deps.ditherer`.

## Use-cases

One row per extracted use-case. Signature is always `(input, deps) => Promise<Result>`.

| Use-case | Replaces | Input (summary) | Result | Ports used |
|----------|----------|-----------------|--------|------------|
| `quantizePalette` ✅ PR5 | `reducedPaletteRawAtom` + `reducedPaletteRgbAtom` orchestration in `app/store/preview/pipeline/quantization.ts` | `{ buf, sourceImage, lockedVecs, cpcHardware, modeConfig, lockedEmptyCount, paletteStrategy, autoDistinctMapping, colorDiversity }` | `{ ok, rawPalette, rgbPalette } \| { ok:false, error }` | `PaletteQuantizer` |
| `ditherImage` ✅ PR6 | `previewImageAtom` orchestration in `app/store/preview/pipeline/preview-image.ts` | `{ normalized, exportPalette, dithering, modeConfig, resizeMode, centerImage }` | `{ ok, image } \| { ok:false, error }` | `ImageDitherer` |
| `buildIndexBuffer` ✅ PR7 | `previewIndexBufferAtom` orchestration in `app/store/preview/pipeline/index-buffer.ts` | `{ previewImage, exportPalette }` | `{ ok, indexBuffer } \| { ok:false, error }` | _none (pure encoder)_ |
| `renderIndexBufferToImageData` ✅ PR8 | `finalPreviewImageAtom` orchestration in `app/store/preview/pipeline/index-buffer.ts` | `IndexBuffer` (`{ buffer, width, height, palette }`) | `ImageData` (total, no union) | _none (pure render)_ |
| `normalizeImage` ✅ PR9 | `normalizedImageAtom` orchestration in `app/store/preview/pipeline/preview-image.ts` | `{ processed, modeConfig, resizeMode }` | `ImageData \| null` (total, no union) | _none (pure)_ |
| `positionNormalizedImage` ✅ PR9 | `positionedNormalizedImageAtom` orchestration in `app/store/preview/pipeline/preview-image.ts` | `{ normalized, modeConfig, resizeMode, exportPalette, centerImage }` | `ImageData \| null` (total, no union) | _none (pure)_ |
| `smoothImage` ✅ PR10 | `smoothedImageAtom` orchestration in `app/store/preview/pipeline/image-pipeline.ts` | `{ resized, horizontalSmoothing, pixelMode, autoDistinctMapping, cpcHardware, modeConfig }` | `ImageData \| null` (total, no union) | _none (pure)_ |

> Status: `smoothImage` landed in PR10 — `smooth-image.ts` (+ 6-test spec). The
> last preview-pipeline transformation step. A pure, **synchronous** function:
> skips smoothing when distinct-mapping is active (CPC Classic + Mode 0,
> `nColors === 16`), when the user toggle is off, or when the mode's pixel width
> is 1, otherwise calls `applyHorizontalSmoothing`
> (`../image-processing/horizontal-smoothing`). **No port** — the helpers are
> deterministic. **Total** — returns `ImageData | null` directly (the `null` is
> the no-upstream-image pipeline-availability case). `smoothedImageAtom` is now a
> thin adapter that assembles input from atoms and delegates; the upstream
> `croppedImageAtom` / `resizedImageAtom` remain processor/canvas plumbing, not
> orchestration.
>
> Status: `normalizeImage` + `positionNormalizedImage` landed in PR9 —
> `normalize-image.ts` (+ spec, 8 tests). Two pure, **synchronous** functions in
> one file (the two atoms stay separate so they keep distinct Jotai dependency
> graphs — `positionNormalizedImage` reads `exportPalette`/`centerImage` that
> `normalizeImage` must not depend on). `normalizeImage` returns the smoothed
> image untouched in `origin`/`cover` and rescales it via
> `getVisualRegionNormalized` (`@/preview`) in `auto`. `positionNormalizedImage`
> places the normalized image into the target CPC canvas via
> `positionImageForAutoMode` (`@/domain/image-processing`) in `auto` only — the
> same helper `ditherImage` already calls directly. **No port** — these
> canvas-backed helpers are deterministic image-processing functions invoked
> directly per the recipe. **Total** — both return `ImageData | null` with no
> `{ ok }` union: the `null` cases (no upstream image, or a degenerate zero-size
> scale) are pipeline-availability concerns, not expected errors, so they map
> straight to the atom's `null`.
>
> Status: `ditherImage` landed in PR6 — `dither-image.ts` (+ spec). It prepares
> the dithering palette (ignored slots → darkest valid color, reusing
> `@/domain/cpc` `replaceIgnoredSlots` + `findDarkestValidColor`), calls
> `deps.ditherer.dither`, wraps the RGB buffer as `ImageData`, and in `'auto'`
> resize mode places it in the target canvas via `positionImageForAutoMode`
> (`@/domain/image-processing`). **Synchronous** on purpose — `dither` is a sync
> call, so the use-case is not a `Promise` (the driving atom stays async only to
> await its upstream pipeline atoms).
>
> Reuse over reinvention: the identical "replace ignored slots with the darkest
> valid color" palette prep was inlined in BOTH `preview-image.ts` and
> `index-buffer.ts`. PR6 folded both onto the `@/domain/cpc` helpers and dropped
> the verbose `[Preview] Index buffer created` log.

> Status: `renderIndexBufferToImageData` landed in PR8 — `render-index-buffer.ts`
> (+ spec). It walks the index buffer once, resolving each pixel's ink index
> against the buffer's palette (missing entries fall back to black) and writing
> opaque RGBA into a fresh `ImageData`. **No port** (pure render) and
> **synchronous** like `buildIndexBuffer`. **Total** — it returns `ImageData`
> directly with no `{ ok }` union, because a valid `IndexBuffer` always renders;
> the "no buffer yet" case stays in the adapter atom (maps to `null`). Reuses the
> application-layer `IndexBuffer` type from `buildIndexBuffer` as its input. This
> is the non-raster preview render; the per-line raster path stays in
> `@/libs/pixsaur-raster` (`renderPreviewWithRaster`) and is out of scope.
>
> Status: `buildIndexBuffer` landed in PR7 — `build-index-buffer.ts` (+ spec). It
> reuses the dither step's "replace ignored slots → darkest valid color" prep
> (`@/domain/cpc`), then converts the already-quantized preview image with the
> **pure** encoder `rgbToIndexBufferExact` (`@/export`, quantize=false /
> fallbackToDarkest=true). **No port** — pure encoders are called directly per
> the recipe — and **synchronous** like `ditherImage`. An empty export palette is
> an explicit `{ ok:false }` (the atom maps it to `null`). The canonical
> `IndexBuffer` result type now lives here; the store's `IndexBufferData`
> (`pipeline/manual-edits.ts`) is a re-export alias, so the adapter depends on the
> application layer rather than the reverse.
>
> Status: `quantizePalette` landed in PR5 — `quantize-palette.ts` (+ spec). It
> produces **both** palettes in one pass: `rawPalette` (RGB, not yet
> hardware-quantized) and `rgbPalette` (hardware-quantized copy, truncated to
> `nColors - lockedEmptyCount`). The two public atoms are now thin selectors
> over a single `quantizedPaletteAtom` adapter that builds the input + injects
> `imageProcessorAtom` and calls the use-case once.
>
> Reuse over reinvention: the per-color/array hardware quantization comes from
> `@/domain/cpc` (`quantizeColorForHardware`, `quantizeArrayForHardware`,
> `truncatePalette`). The old inlined `quantifyCPC{Classic,Plus}WithLocked`
> helpers and the locked-vec map were deleted as exact duplicates of those, and
> the verbose `logger.info` traces were dropped (only the processor-missing
> `logger.warn` survives, in the thin adapter atom).

## Notes

The quantizer is also used (separately) by `quantizerAtom` in the same file for
dithering — that path is **not** part of this use-case; only palette
quantization was extracted.
