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
