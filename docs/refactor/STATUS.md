# Refactor — STATUS (canonical resume point)

**Read this first when resuming in a new session.** It always reflects the
current state. History lives in `docs/refactor/sessions/` (append-only).

Effort: incremental strangler-fig toward **use-cases + light ports** (NOT a
rewrite). Jotai/React become thin adapters over pure use-cases. Rationale &
big picture: `src/export/application/README.md` and the memory note
`refactor-clean-archi-plan`.

## Where we are

- **Branch:** `refactor/pr0-guardrails`
- **Current step:** PR4 (`useExportActions` hook → `export-panel.tsx` thin UI) —
  DONE & committed (`9bb16ae`). **Export pilot complete & committed (PR1–PR4):**
  PR1 `e177a53`, PR2 `d9c01cb`, PR3 `273dafd`, PR4 `9bb16ae` (PR0 `a743503`).
- **Next step:** PR5 — extract the **quantize** use-case (scoped below) with
  `/extract-use-case`.

## Next step (PR5 — quantize) — planned & decision-locked

Replay the use-cases + ports pattern on quantize. Decisions agreed 2026-06-11:

- **Home:** `src/preview/application/` (quantize is part of the preview pipeline;
  mirrors `src/export/application/`). Seed its `README.md` registry there.
- **Port:** narrow `PaletteQuantizer` facet = `Pick<ImageProcessor,
  'quantizePalette'>` (in `src/preview/application/ports.ts`). The runtime adapter
  is the existing `imageProcessorAtom` value (`@/libs/pixsaur-adapter`); inject it
  as `deps.quantizer`. Do **not** depend on the full `ImageProcessor`.
- **Scope:** one use-case `quantizePalette(input, deps) => Promise<Result>`
  covering BOTH atoms in `src/app/store/preview/pipeline/quantization.ts`:
  - `reducedPaletteRawAtom` (impure: locked-vec hardware quantify → `quantizer.quantizePalette`)
  - `reducedPaletteRgbAtom` (pure: hardware-quantify palette + truncate)
  - Result `{ ok:true, rawPalette, rgbPalette } | { ok:false, error }`.
- **Input:** `{ buf, sourceImage, lockedVecs, cpcHardware, modeConfig,
  lockedEmptyCount, paletteStrategy, autoDistinctMapping, colorDiversity }`.
- **Pure helpers to relocate into the use-case (or `@/domain/cpc`):** the
  locked-vec quantify (Classic/Plus) and `quantifyCPC{Classic,Plus}WithLocked`
  + truncation. Factor the shared per-color quantify so jscpd stays flat.
- **Drop the verbose `logger.info` calls** from the pure use-case (keep none, or
  move to the thin adapter atom).
- **Rewire + delete old path:** the two atoms become thin adapters that build the
  input, read `imageProcessorAtom`, call the use-case, expose `rawPalette` /
  `rgbPalette`. Delete the inlined orchestration in the same change (knip must
  show no orphan helpers).
- After quantize: the preview pipeline.

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
| PR5 | `quantizePalette` use-case + `PaletteQuantizer` port (extract `reducedPaletteRaw`/`reducedPaletteRgb` atoms) | ⬜ next (scoped) |
| — | Then: preview pipeline | ⬜ later |

## Guardrail baseline (ratchet — must not regress)

Detectors are **report-only** (not in blocking `pnpm check`). Run
`pnpm refactor:preflight`. Numbers below are the high-water mark to drive down.

- jscpd: **2.03% duplication, 45 clones** (set 2026-06-10)
- knip: **25 unused files, 62 unused exports** (set 2026-06-10)
- Known real duplication to resolve later: `validate-custom-dimensions.ts`
  identical in `src/preview/` and `src/source/`.

## How to resume (checklist)

1. Read this file, then the latest report in `docs/refactor/sessions/`.
2. `export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"` (WSL PATH quirk).
3. `git branch --show-current` and `git status` to confirm state.
4. For a use-case extraction, run the `/extract-use-case` skill.
5. End the session with the `/session-report` skill (updates this file +
   appends a dated report).
