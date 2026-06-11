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

> `PaletteQuantizer` is a facet of `ImageProcessor` — use-cases depend only on
> the one method they need. No web/desktop split: the same processor serves
> both (the desktop app runs in a webview); the atom injects the resolved
> processor directly as `deps.quantizer`.

## Use-cases

One row per extracted use-case. Signature is always `(input, deps) => Promise<Result>`.

| Use-case | Replaces | Input (summary) | Result | Ports used |
|----------|----------|-----------------|--------|------------|
| `quantizePalette` ✅ PR5 | `reducedPaletteRawAtom` + `reducedPaletteRgbAtom` orchestration in `app/store/preview/pipeline/quantization.ts` | `{ buf, sourceImage, lockedVecs, cpcHardware, modeConfig, lockedEmptyCount, paletteStrategy, autoDistinctMapping, colorDiversity }` | `{ ok, rawPalette, rgbPalette } \| { ok:false, error }` | `PaletteQuantizer` |

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
