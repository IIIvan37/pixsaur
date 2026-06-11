# Palette — application layer (use-cases + ports)

Living registry for the palette feature. **Read this before adding a use-case or
a port** (`/extract-use-case` step 1) so you reuse what exists instead of
duplicating it. Keep it in sync when you land a change.

Target architecture (same as `src/export/application/` and
`src/preview/application/`): business orchestration lives in pure use-cases;
impure side-effects arrive through ports; Jotai atoms / React components are thin
adapters that assemble the input, inject the real ports, and map the result to
state.

## Ports

None yet — the only use-case so far is pure (no side-effects). Reuse an existing
port before defining a new one when that changes.

## Use-cases

One row per extracted use-case.

| Use-case | Replaces | Input (summary) | Result | Ports used |
|----------|----------|-----------------|--------|------------|
| `reducePalette` ✅ | `setReducedPaletteAtom` orchestration in `app/store/palette/palette.ts` | `{ reduced, prev, maxColors }` | `PaletteSlot[]` (total, no union) | _none (pure)_ |

> Status: `reducePalette` landed as the first palette use-case (after the export
> and preview pilots). A pure, **synchronous** function: it extracts the locked
> colors from the current palette, drops any reduced color too close to a locked
> one (visual-duplicate guard), then rebuilds the slots — keeping locked slots
> verbatim inside the mode budget, filling the rest from the filtered reduced
> queue, and padding to 16 while preserving the locked flag of out-of-mode slots.
> **No port** — the helpers are deterministic. **Total** — returns
> `PaletteSlot[]` directly (no `{ ok }` union, no change-detection): the
> `userPaletteAtom` setter already short-circuits a no-op storage write, so the
> adapter just delegates and sets.
>
> Reuse over reinvention: the perceptual-distance + locked-slot helpers came from
> `@/domain/cpc` (`isColorTooClose`, `extractLockedColors`). The store's inlined
> `isColorTooClose` / `MIN_PERCEPTUAL_DISTANCE` / `slotsWithinModeLimit`
> duplicates were deleted; the `lockedVectorsAtom` / `lockedEmptySlotsCountAtom`
> selectors were rewired onto `extractLockedColors` / `countLockedEmptySlots`;
> and the store's duplicate `PaletteSlot` type now re-exports `@/domain/cpc`. The
> verbose `logger.info` traces in the old atom were dropped.

## Notes

`PaletteSlot` is owned by `@/domain/cpc` (`slot.ts`); the store type
(`app/store/palette/types.ts`) re-exports it. Use-cases depend on the domain
type, never on the store.
