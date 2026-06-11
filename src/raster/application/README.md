# Raster — application layer (use-cases + ports)

Living registry for the raster feature. **Read this before adding a use-case or
a port** (`/extract-use-case` step 1) so you reuse what exists instead of
duplicating it. Keep it in sync when you land a change.

Target architecture (same as `src/export/application/`,
`src/preview/application/` and `src/palette/application/`): business
orchestration lives in pure use-cases; impure side-effects arrive through ports;
Jotai atoms / React components are thin adapters that assemble the input, inject
the real ports, and map the result to state.

## Ports

| Port | Method | Runtime adapter | Used by |
|------|--------|-----------------|---------|
| `IdGenerator` | `generate(): string` | `generateChangeId` (`app/store/raster/raster-changes.ts`, `Date.now()`+`Math.random()`) | `optimizeRaster` |

## Use-cases

One row per extracted use-case.

| Use-case | Replaces | Input (summary) | Result | Ports used |
|----------|----------|-----------------|--------|------------|
| `optimizeRaster` ✅ | `autoOptimizeRasterAtom` orchestration in `app/store/raster/raster-optimizer.ts` | `{ sourceImage, exportPalette, modeConfig, hardware, ditheringIntensity, existingChanges, resetChanges, maxChangesPerLine }` | `{ optimizationResult, changes, changesCount, linesAffected }` (total) | `IdGenerator` |

> Status: `optimizeRaster` is the first raster use-case (seeds the folder). A
> pure, **synchronous** function: it derives the fixed global palette (Mode 0
> Plus keeps the first 12 colors fixed, indices 0-3 are per-line raster slots;
> other modes use the full `nColors` budget, padding with black), preprocesses
> the source so each line respects the per-line color limit
> (`preprocessImageForRaster`), runs `optimizeLinePalettesWithIndexBuffer`
> (`useProvidedPalette: true`, same quantization as non-raster mode), filters
> changes beyond the mode height, and assigns stable ids — **preserving** the id
> of any change already on the same `(line, inkIndex)` (sourced from the current
> set even when `resetChanges` refines from scratch), minting new ones via the
> `IdGenerator` port.
>
> **Total** — no `{ ok }` union: the only failure (no source image) is guarded by
> the atom adapter before calling the use-case. The adapter owns the atom reads
> (incl. the two async `positionedNormalizedImageAtom` /
> `exportPaletteWithSlotsAtom`), the state writes
> (`rasterOptimizationResultAtom`, `rasterChangesAtom`, `rasterVersionAtom`++),
> and disabling the mutually-exclusive Mode R / EGX modes.
>
> Reuse over reinvention: the heavy lifting stays in `@/libs/pixsaur-raster`
> (`preprocessImageForRaster`, `optimizeLinePalettesWithIndexBuffer`,
> `MODE_0_*`); `cpcPalette` comes from `@/palettes/cpc-palette`. The verbose
> `logger.time` / `logger.info` traces in the old atom were dropped.

## Notes

`RasterChange` is owned by `@/libs/pixsaur-raster/types`. The use-case depends on
the lib type, never on a store-local copy.
