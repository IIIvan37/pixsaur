# Session report — 2026-06-12 — file-layout reorg (ADR-001)

## Goal of the session
Normalize the incoherent src/ layout: single source of truth for scattered
pure functions, dissolve orphan dirs, document the layout convention and
enforce layering with a guard script.

## Done
- **Dedup mode-0 hue-diversity** (`51e0bab`): single parameterized
  implementation in `pixsaur-color/src/quant/mode0-hue-diversity.ts` with two
  bit-for-bit presets (`CPC_ADAPTER_MODE0_TUNING` 100/200/25/0.15/30° +
  slider, `STRATEGY_V2_MODE0_TUNING` 20/30/0.3/45°, incl. the unguarded
  `wrapHueDistance` for achromatic hues). Deleted
  `pixsaur-adapter/adapters/color-selection-helpers.ts` (599 lines) and the
  private copies in `palette-strategies-v2.ts`. `ColorCandidate` now lives in
  the shared module (v2 re-exports it). Spec moved, only imports changed.
- **CPC mode config → domain** (`ad27ec6`): `CPC_MODE_CONFIG`, `PixelMode`,
  `CpcModeKey/Config`, build/parse helpers → `domain/cpc/mode-config.ts`;
  `ResampleStrategy` → `domain/image-processing`; user-selectable
  `PaletteStrategy` union → `pixsaur-color/src/quant/strategy-names.ts`.
  `store/config/types.ts` is now a re-export shim. Libs + features no longer
  import `@/app`.
- **Generic color utils → pixsaur-color** (`79ab29c`): colorToKey/keyToColor/
  createColorKeySet → `utils/color-key.ts`; `findDarkestInPalette` →
  `utils/luminance.ts` (distinct from gamma-corrected `findDarkestColor` —
  both kept); `findDarkestValidColor` → `domain/cpc/ignored-slot.ts`;
  `domain/cpc/color-utils.ts` deleted, barrel keeps the public API.
- **Dissolved `src/types` + `src/source`** (`abcafc5`): image contract types →
  `domain/image-processing/image-types.ts` (dead `ConfiguredImage` deleted);
  `image-resize` → `preview/image-processing/`; knip no longer ignores
  `src/types/**`.
- **Dissolved `src/hooks`** (`16051d3`): colocation — `use-observed-canvas-width`
  (typo "vidth" fixed) → `components/image-preview/`; the 3 converter hooks →
  `app/components/image-converter/`.
- **Dissolved `src/palettes`** (`daa73ad`): hardware palette data →
  `domain/cpc/cpc-palette.ts`; 4-bit CPC Plus math (`toCPCPlusLevel`,
  `getCPCPlusPaletteIndex`) → `pixsaur-color/src/utils/cpc-plus.ts`,
  deduplicating `quantifyToCPCPlusLevel` against domain `toCPCPlusLevel`.
- **Feature-layer cleanup** (`f8f878b`): `resize-types` →
  `domain/image-processing` (store shim kept); pure DSK format math
  (`dsk-workspace-utils`, zero imports) + `DskImage` type → export feature;
  store `dsk-workspace.ts` re-exports `DskImage`. Features now import neither
  `@/app` nor `@/components` (thematic barrels excepted).
- **Layer guard** (`978f762`): `scripts/check-layer-imports.js` — data-driven
  rules (core/libs/domain/features), relative-escape detection, ratchet
  `ALLOWED_EXCEPTIONS` (the 2 thematic barrels). Wired into `pnpm check` AND
  the pre-commit hook; hook now actually runs the radix guard (was running the
  utils guard under that label). `check-utils-imports.js` retired (matched
  only dead `@/utils` paths). Negative-tested (jotai-in-libs + relative
  escape both fail).
- **Docs** (`6c077ff`): `docs/refactor/ADR-001-file-layout.md` (convention,
  decision tree, guard rules, exceptions register, non-goals) + CLAUDE.md
  ("File layout — where does a new file go", guard list updated, stale
  src/source//src/types references purged). CLAUDE.md committed for the first
  time.

## Not done / remaining
- `src/libs/types.ts` split (CPC types → domain, ModeR types → pixsaur-mode-r)
  — deferred, recorded as exception #3 in ADR-001 (legal under the rules).
- `src/components` (≈200 files) and `src/app/store` internal layout untouched
  — explicit non-goals (user decision).
- Backlog #5 (optional EGX/Mode-R atom extractions) still open from before.
- UI smoke test (`pnpm dev`) not run — changes were import-path moves covered
  by the 2112-test suite; worth a quick visual check before pushing.

## Decisions taken
- The two diverged copies of the mode-0 selection algorithm are preserved
  bit-for-bit via tuning presets — do NOT harmonize constants without visual
  validation (they encode production behavior c244923 vs strategy v2).
- Store layout stays frozen: `config/types.ts`, `config/resize-types.ts` and
  the `DskImage` re-export are permanent shims; never re-declare those types
  locally (ADR-001 exceptions register).
- Layer enforcement via a plain-node guard (same idiom as existing guards),
  not dependency-cruiser/ESLint — fits the Biome-only toolchain.
- `ResampleStrategy`, resize types and image contract types belong to
  `domain/image-processing`; DSK format math belongs to the export feature.

## Guardrail status
- jscpd: **1.61% / 38 clones** (baseline 1.62%/39 → improved, ratchet lowered)
- knip: **0 unused files / 51 unused exports / 19 unused types / 1 unused dep**
  (exports 52→51, `src/types/**` ignore removed → coverage widened; no
  regression)
- typecheck / tests: pass — 2112 passed (164 files), `pnpm check` green with
  the new layer guard

## State to resume from
- Branch: `refactor/pr0-guardrails` · committed? **y** (through `6c077ff`,
  19 commits ahead of origin — push is overdue)
- Next action: **push the branch / open the PR** (or first do a quick
  `pnpm dev` visual smoke of palette + quantization, the only UI-adjacent
  moves), then optionally tackle backlog #5.
- Watch out for: the layer guard is now blocking in `pnpm check` and the
  pre-commit hook — new code that imports `@/app` from a feature dir or
  Jotai from libs/domain will fail the commit. The thematic barrels
  (`export/index.ts`, `preview/index.ts`) are the only files allowed to
  import `@/components` from a feature dir.
