# Refactor — STATUS (archived — refactor complete)

> **✅ DONE & MERGED.** The clean-archi / strangler-fig refactor is complete and
> was merged into `main` (rebased — original `refactor/pr0-guardrails` SHAs were
> rewritten) and shipped in **1.13.0**. `main` has since moved on with new feature
> work on top. This file is now a **historical record**, not a live resume point.
> The use-cases + ports architecture and ADR-001 file layout are the current
> baseline; the layering guard (`check-layer-imports.js`) enforces them.

History lives in `docs/refactor/sessions/` (append-only, **local-only since
2026-06-12** — git-ignored, only `_TEMPLATE.md` is tracked).

Effort: incremental strangler-fig toward **use-cases + light ports** (NOT a
rewrite). Jotai/React became thin adapters over pure use-cases. Rationale &
big picture: `src/export/application/README.md` and the memory note
`refactor-clean-archi-plan`.

## Post-review remediation (August 2026 — live)

> The clean-archi refactor below is finished and archived. What follows is a
> **new, separate** effort: applying the findings of
> `architecture-review-2026-08.md` (11 candidates, 4 waves). This section is the
> live resume point; everything under "Where we landed" is history.

- **Wave 1 — DONE** (branch `refactor/post-review-remediation` — renamed from
  `fix/distinct-mapping-explicit-channel` on 2026-08-27, 3 commits,
  not pushed). Report: `sessions/2026-08-27-wave1-distinct-mapping-dead-code.md`.
  - `0a487e3` candidate 2: the distinct-mapping table now travels as a value
    (`quantizePalette` drains the ambient transport; `mapAndDither` /
    `applyNoDither` / `dither` take it as an argument; `isDistinctMappingEnabled`
    deleted). Fixes a real stale-state bug — the CPU fallback dithered through
    the previous image's table whenever `ReGLQuantizer` threw for an image under
    128×128.
  - `2d67f4d` dead-code sweep: `exportModeRSna`, `generateSCRAsmPlus`,
    `egxPreviewImageAtom`. Deliberately kept: `quantizeEGX` (for candidate 1 —
    which then **deleted** it instead, see wave 2) and `getCapabilities` (only
    observation window on live WebGL detection).
  - `b7a9b55` the review itself, recorded.
- **Wave 2 — candidate 1 DONE** (same branch, 2 more commits). Report:
  `sessions/2026-08-27-wave2-egx-one-module.md`.
  - `a39ca30` candidate 1a: the `quantizeEgx` use-case
    (`src/preview/application/quantize-egx.ts`, 28-test table over type ×
    first-line × dithering mode) replaces the 80-line loop in
    `egxIndexBufferAtom`. The lib's never-shipped `quantizeEGX` (+ preview
    generators + the helpers only it used) is **deleted, not adopted**: it had
    no dithering and no low-res pixel pairing, so adopting it would have been a
    regression.
  - `f6d31b9` candidate 1b: new shared `resizeToMode` helper
    (`src/preview/image-processing/resize-to-mode.ts`) parameterized by the
    target `CpcModeConfig`; `resizedImageAtom` and `egxNormalizedImageAtom` are
    both thin adapters over it plus the `normalizeImage` /
    `positionNormalizedImage` use-cases. **EGX now gets linear-light
    resampling** (a real rendering change — eyeball an EGX export before
    merging). `shouldGrayOut` absorbed into `egx-final.ts`;
    `egx-preview-image.ts` deleted.
- **Wave 2 — candidate 10 DONE — wave 2 complete** (same branch, 2 more
  commits). Report: `sessions/2026-08-27-wave2-dsk-file-sink.md`.
  - `3233c8f` candidate 10a: new shared
    `src/export/exports/exporters/dsk-image-format.ts` (`toDskModeConfig` →
    `CpcModeConfig`, `isStandardDskMode`, `generateDskStandardScr`, +10-test
    spec with real encoders). Both DSK exporters drop their private
    `ModeConfig` clone, standard-mode test and SCR producer — including the
    async copy whose 3 dynamic imports pulled the whole `@/export` barrel.
  - `2850ef5` candidate 10b: new `DskWorkspaceBuilder` port + adapter and the
    `exportDskWorkspaceToZip` use-case (`src/export/application/`, 5-test spec,
    **zero `vi.mock`**). `dsk-workspace-panel.tsx` is now a thin adapter —
    `isTauri` / `saveZipFileTauri` / `downloadFile` left the component and the
    save goes through `resolveFileSink()`.
- **Wave 2 verified by hand 2026-08-27 (web build)**: EGX renders correctly with
  the new linear-light resampling, smoothing behaves, and the DSK workspace
  export works end to end. The **Tauri build is still unverified** — the desktop
  save path (`tauriFileSink`, native dialog) is the one branch the web run never
  exercises. Smoke-test a DSK export in `pnpm tauri:dev` before merging.
- **Wave 3 — candidate 4 DONE** (same branch, 1 commit). Report:
  `sessions/2026-08-27-wave3-standard-mode-verdict.md`.
  - `d4b1587`: new `src/domain/cpc/screen-capability.ts` (+22-test spec) —
    `isStandardScreen`, `isStandardEgxScreen`, `maxScreenAddress`,
    `screenCapability` → `{ isStandard, canExportScr, canExportSna }`. The
    `{mode 0/160, 1/320, 2/640} × 200 × !overscan` rule had **six** copies in
    four signatures (the review found five; `export-sna.ts` hid a sixth); all
    six now read the domain module, including the export dialog — the rule left
    the React tree, and `export-zip`'s "must match the UI logic in
    export-config-dialog.tsx" comment is true by construction instead of by
    hope. `isStandardDskMode` (added the day before for candidate 10) folded in.
  - Deliberately unchanged: `export-zip` still gates SNA only on
    `config.content.includeSNA`. Adding a `canExportSna` gate is a behaviour
    change, not a refactor — the dialog already prevents the case.
- **Wave 3 — NEXT**: candidate 5 (name the ASM artifact producers), then
  candidate 6 (collapse the SNA production run).
- **Wave 4**: candidates 3, 7, 8, 9 (structural). Candidate 11 falls out of
  candidate 8 — not worth its own PR.

### Ratchet baselines (lowered 2026-08-27 — may only shrink)

| Detector | Baseline | Was |
|---|---|---|
| knip unused exports | **42** | 52 |
| knip unused types | **19** | 19 |
| knip unused files | 1 (intentional) | 1 |
| jscpd clones | **37** | 39 |
| jscpd ratio | **1.49 %** | 1.62 % |

The jscpd *ratio* reads 1.51 % since wave 2 while the clone count stayed at 37:
deleting ~400 lines shrinks the denominator. Judge the ratchet on the clone
count; the ratio only moves down when a clone actually goes away. Wave 2's
candidate 10 removed a hand-copied SCR producer without moving either number —
jscpd never flagged it (the two copies had drifted sync/async), which is why the
review reads code and the detectors only guard the floor.

Known pre-existing noise: `pnpm check` reports ~9 biome format errors in
`src-tauri/gen/` and `src-tauri/target/` on machines that have run a Tauri
build. Those paths are git-ignored; the errors are not in tracked sources.

## Where we landed

- **Parallel effort — quality gates from `loupe`:** branche
  `chore/quality-gates-from-loupe`. Plan : `PLAN-quality-gates-from-loupe.md`.
  **Phase 1 (Stryker) DONE** (`f7b5103`, score 79.30 %, break 72) et **Phase 2
  (skills) DONE** (`72a14a7` : tdd-cycle, new-feature-hexa, quality-gate,
  react-testing-patterns, lingui-best-practices + session-report enrichi) et
  **Phase 3 (Sheriff) DONE** (`7065339` : diagnostic non-bloquant `check:arch` ;
  fuite `core→@/tauri` du logger corrigée par un port `LogSink`), **Phase 4
  (react-doctor + impeccable) DONE** (`2a8b8b8` : `check:react` ratchet +
  `check:design` report-only) et **Phase 5 (gate composite) DONE** (`b07dfb5` :
  `pnpm gate` + CI PR). **Les 5 phases sont livrées et mergées sur `main`**
  (#345 : coverage, jscpd et react-doctor passent en *enforce*). Reports :
  `sessions/2026-07-05-*`.
- **Merged into `main`** and shipped in 1.13.0. The local
  `refactor/pr0-guardrails` branch has been deleted (content all on `main`).
- **Last step:** file-layout reorg (ADR-001) — DONE (8 commits
  `51e0bab`…`6c077ff`, rebased onto main). Report:
  `sessions/2026-06-12-file-layout-reorg.md`.
  Deduped the diverged mode-0 hue-diversity selection into
  `pixsaur-color/quant/mode0-hue-diversity.ts` (two bit-for-bit presets, 599-line
  adapter helper deleted); moved `CPC_MODE_CONFIG`/mode types + hardware
  palettes into `@/domain/cpc`, resize/image types into
  `@/domain/image-processing`, `PaletteStrategy` + 4-bit CPC-Plus math into
  pixsaur-color; dissolved `src/types`, `src/source`, `src/hooks`,
  `src/palettes`; store `config/types.ts` / `config/resize-types.ts` /
  `DskImage` are now re-export shims (store layout frozen — never re-declare
  locally). New blocking guard `scripts/check-layer-imports.js` (in `pnpm
  check` + pre-commit; pre-commit now also actually runs the radix guard);
  `check-utils-imports.js` retired. Convention + decision tree + exceptions
  register in `docs/refactor/ADR-001-file-layout.md` and CLAUDE.md.
- **Prev step:** backlog #6 — minor cleanups — DONE (`8937485`). Report:
  `sessions/2026-06-12-backlog-6-minor-cleanups.md`. (1) Removed the 2 Biome
  `noImportantStyles` warnings in `draggable-dialog.module.css` by driving the
  drag position through `--dialog-x`/`--dialog-y` CSS custom properties (set in
  `draggable-dialog.tsx`), so the mobile `@media` overrides `left`/`top` via a
  normal cascade. (2) Removed the 4 `setTimeout(() => paintAtCursor(), 0)`
  workarounds in `editor-canvas.tsx` (Jotai writes are sync → cursor is already
  readable) and deduped the 4 arrow cases into a `moveAndPaint(direction)`
  helper. (3) `image-preview.tsx` popup no longer injects
  `documentElement.innerHTML`; it opens a `text/html` Blob object URL. Suite
  2112 passed, typecheck + `pnpm check` clean, preflight at baseline (jscpd
  39/1.62%, knip 1/52/19).
- **Prev step:** backlog #4 — specs for `src/domain/` — DONE (`8da1e58`).
  Report: `sessions/2026-06-12-domain-specs.md`. Added 7 spec files / 61 tests
  for the previously-untested pure domain modules (cpc/quantization,
  color-distance, color-utils, palette-filtering, ignored-slot, slot;
  image-processing/positioning). `src/raster/` already covered (PR12/PR15), the
  two barrels need no spec. Suite 2112 passed (+61), typecheck clean, jscpd
  unchanged (39/1.62%); knip unused exports 59→52 (specs now import several
  domain symbols — test usage, not real dead-code reduction).
- **Prev step:** backlog #3 — deps cleanup — DONE (`a30e69c`). Report:
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
  4. ~~Specs for `src/domain/` (9 files, 0 specs) and `src/raster/`.~~ ✅ done
     (`8da1e58`): 7 spec files / 61 tests for the cpc + image-processing domain
     modules; `src/raster/` was already covered (PR12/PR15).
  5. Optional extractions (atoms that DO hold real logic despite the earlier
     "skip EGX/Mode-R" call): `mode-r-image.ts:33-210`,
     `egx-palette.ts:56-119`, `egx-image.ts:50-138`. ⟵ **next** (optional)
  6. ~~Minor: popup `innerHTML` (`image-preview.tsx`), 2 Biome `!important`
     warnings, `setTimeout(…, 0)` workarounds in `editor-canvas.tsx`.~~ ✅ done
     (uncommitted): `innerHTML`→`text/html` Blob URL; `!important`→`--dialog-x/y`
     custom props; `setTimeout`→sync `paintAtCursor` + `moveAndPaint` helper.

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
| — | Backlog #4: specs for `src/domain/` — 7 spec files / 61 tests (cpc quantization/color-distance/color-utils/palette-filtering/ignored-slot/slot + image-processing/positioning). `src/raster/` already covered. | ✅ done (`8da1e58`) |
| — | Backlog #6: minor cleanups — popup `innerHTML`→Blob URL, 2 Biome `!important`→`--dialog-x/y` custom props, 4 `setTimeout(…,0)` cursor-paint workarounds→sync + `moveAndPaint` helper. | ✅ done (`8937485`) |
| — | File-layout reorg (ADR-001): dedup mode-0 hue-diversity into pixsaur-color (2 bit-for-bit presets); CPC mode config + hardware palettes → domain/cpc; resize/image types → domain/image-processing; PaletteStrategy + CPC-Plus 4-bit math → pixsaur-color; dissolve src/{types,source,hooks,palettes}; DSK utils + DskImage → export feature; store shims; new blocking `check-layer-imports` guard; ADR-001 + CLAUDE.md. | ✅ done (`51e0bab`…`6c077ff`) |

## Guardrail baseline (ratchet — must not regress)

Detectors are **report-only** (not in blocking `pnpm check`). Run
`pnpm refactor:preflight`. Numbers below are the high-water mark to drive down.

- jscpd: **1.61% duplication, 38 clones** (lowered 2026-06-12, mode-0
  hue-diversity dedup; previously 39 after the image-preview draw dedup)
- knip: **0 unused files, 51 unused exports, 19 unused types, 1 unused dep**
  (exports 52→51 2026-06-12 file-layout reorg, with `src/types/**` no longer
  knip-ignored — coverage widened, dead `ConfiguredImage` deleted)
  (files 23→0 2026-06-11, `5ba1e97`: deleted dead barrels + orphan modules;
  deps 15→1 2026-06-12, `a30e69c`: dropped 11 dead deps — the lone remaining
  `@netlify/functions` is an intentional Netlify infra placeholder; exports
  59→52 2026-06-12, `8da1e58`: new domain specs import several previously-unused
  symbols — test usage, *not* real product usage, so don't over-trust this)
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
