# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **🔧 Refactor in progress (clean-archi / strangler-fig).** Before continuing any
> refactor work, read **`docs/refactor/STATUS.md`** (canonical resume point) and the
> latest report in `docs/refactor/sessions/`. Use the `/extract-use-case`,
> `/refactor-preflight` and `/session-report` skills. Close every step with a session report.

## Project

Pixsaur converts modern images into authentic Amstrad CPC graphics (palette quantization, dithering, CPC-native export formats). It ships as both a web app (Vite) and a desktop app (Tauri 2 / Rust). Frontend is React 19 + TypeScript with Jotai for state. Image processing runs on the GPU (ReGL/WebGL) with an automatic CPU fallback.

Requires Node `>=24.11.0` (pinned to `v24.11.0` in `.nvmrc`) and pnpm `10.11.0` (use `pnpm run setup` to activate via corepack).

## Commands

```bash
pnpm dev                  # Web dev server at http://localhost:5173
pnpm tauri:dev            # Desktop app (Tauri) dev mode — requires Rust toolchain
pnpm build                # tsc -b && vite build (web, output in dist/)
pnpm tauri:build          # Build desktop binaries

pnpm test                 # Vitest (watch by default)
pnpm test -- src/path/to/file.spec.ts   # Run a single test file
pnpm test:coverage        # Vitest with v8 coverage

pnpm typecheck            # tsc --noEmit
pnpm check                # Biome check + the custom import/console guard scripts (see below)
pnpm check:fix            # Biome auto-fix

pnpm i18n:extract         # Extract Lingui message catalogs
pnpm i18n:compile         # Compile catalogs (run after extract; required before build)
```

Tests use Vitest with `happy-dom` and globals enabled — no per-file imports of `describe`/`it`/`expect` needed. Setup lives in `vitest.setup.tsx`.

## Conventions enforced by tooling

The pre-commit hook (`.husky/pre-commit`) runs `tsc --noEmit`, `typecheck:comprehensive`, Biome `check --write`, and the custom guard scripts. `pnpm check` runs the same guards. They will block commits, so respect them up front:

- **No raw `console.*` in `src/`** (`scripts/check-console-usage.js`). Use the centralized logger from `src/core` (`@/core`) instead — prefer domain loggers (`adapterLogger`, `dskLogger`, `quantizerLogger`, etc.). Exceptions: test files and a few allow-listed paths.
- **Radix UI imports only inside `src/components/ui`** (`scripts/check-radix-imports.js`). Other code consumes the wrapped `ui` components, never `@radix-ui/*` directly.
- **Tauri imports only inside `src/tauri`** (`scripts/check-tauri-imports.js`). Never import `@tauri-apps/*` outside `src/tauri/`; the rest of the app goes through that module so the web build stays Tauri-free.
- **Layering rules** (`scripts/check-layer-imports.js`, see `docs/refactor/ADR-001-file-layout.md`). `src/libs/**` and `src/domain/**` never import `jotai`, `react`, `@/app`, `@/components` or feature dirs; feature dirs (`export`, `preview`, `palette`, `raster`, `editor`) never import `jotai`, `react`, `@/app` or `@/components`; `@/test-utils` is spec-only. The guard's exception list is a ratchet — never add to it without an architecture decision.

Biome config (`biome.json`): single quotes, no semicolons, no trailing commas, 2-space indent, 80 col, single-quote JSX. `noExplicitAny` and `noNonNullAssertion` are off. Use the `@/*` path alias (maps to `src/*`) rather than long relative paths.

## File layout — where does a new file go

Layers (`docs/refactor/ADR-001-file-layout.md` is the full ADR; an arrow means "may import"):

```
app/, components/  →  <feature>/application  →  domain/  →  libs/
all layers → core/ (logger, invariants) ; tauri/ = only @tauri-apps/* site
```

Decision tree for a new pure function:

1. CPC hardware fact or rule (modes, hardware palette, slots) → `src/domain/cpc`
2. Generic color/image math (no CPC knowledge, or CPC only via parameters) → `src/libs/pixsaur-color`
3. Orchestration of a user action / pipeline stage (`(input, deps) => Result`) → `src/<feature>/application` (use-case)
4. Side effect (DOM, files, GPU, clock) → port in `<feature>/application/ports.ts` + adapter
5. UI-only helper or hook with one consumer → colocated next to the component
6. Cross-cutting (logging, invariants) → `src/core`

`src/app/store/config/types.ts`, `config/resize-types.ts` and the `DskImage` re-export in `store/dsk-workspace` are **re-export shims** (store layout is frozen during the strangler-fig refactor) — never re-declare those types locally; the canonical definitions live in `@/domain/cpc`, `@/domain/image-processing`, `@/export/exports/types` and pixsaur-color `quant/strategy-names`.

The mode-0 hue-diversity color selection has a single shared implementation (`pixsaur-color/src/quant/mode0-hue-diversity.ts`) with two bit-for-bit tuning presets (GPU adapter vs strategy v2) — do not "harmonize" their constants.

## Architecture

### State: Jotai atom pipeline

State is **not** a single store object — it is a graph of derived Jotai atoms organized under `src/app/store/`. The image-processing flow is modeled as a chain of derived atoms, each stage depending on the previous:

```
sourceImage → crop → resize → smooth → quantize → dither → indexBuffer → manualEdits → finalPreview
```

The pipeline atoms live in `src/app/store/preview/pipeline/` and are re-exported through `src/app/store/preview/preview.ts` (a hub module). Key store areas:

- `store/config/` — user-facing settings: CPC mode, palette strategy, dithering, adjustments, hardware/processor selection, resize/dimensions. `config/types.ts` and `config/resize-types.ts` are re-export shims; `CPC_MODE_CONFIG` (the source of truth for mode 0/1/2 dimensions and color counts) lives in `@/domain/cpc`, `PaletteStrategy` in pixsaur-color.
- `store/preview/` — the core preview pipeline plus two alternate rendering modes that branch off it: `egx/` (EGX line-by-line mode alternation) and `mode-r/` (dual-image interlaced rendering).
- `store/raster/` — per-scanline palette changes (rasters), including auto-regeneration hooks.
- `store/adapters/` — wires the image processor (see below) into atoms.
- `store/image/`, `store/palette/`, `store/editor/`, `store/dsk-workspace/`, `store/locale/`, `store/settings/`.

When tracing why a preview looks a certain way, follow the atom dependency chain from the final preview atom backward, not imperative call sites.

### Image processors (CPU/GPU abstraction)

`src/libs/pixsaur-adapter/` defines the `ImageProcessor` interface (`interfaces.ts`) and the ReGL-based implementation (`adapters/regl-processor.ts`). `factory.ts` exposes `processorFactory.createBestProcessor(type)` where `type` is `'auto' | 'cpu' | 'gpu'` — `auto` attempts GPU and silently falls back to CPU. All adjustments and palette quantization go through this interface, so the same code path serves web and desktop. The factory is deliberately independent of Jotai (it only depends on the lib + regl).

### Domain & libraries

- `src/domain/cpc/` — pure CPC domain logic (quantization, hardware palettes, mode config, palette slots, perceptual color distance, ignored-slot handling). Imported via `@/domain/cpc`. `IGNORED_SLOT` is a special palette-slot marker. `src/domain/image-processing/` owns positioning, resize types and the image contract types.
- `src/libs/pixsaur-color/` — the custom colorimetric library (color space conversion, distance metrics, histograms, quantization, dithering maps including Ostromoukhov/blue-noise). This is the math core; `src/domain/cpc` and the processors build on it.
- `src/libs/pixsaur-mode-r/`, `pixsaur-egx/`, `pixsaur-raster/` — the three advanced rendering modes' algorithms (Mode R dual-image blending, EGX, raster line-palette optimization).
- `src/libs/rasm-wasm/` — RASM (Z80 assembler) compiled to WASM, used to build DSK disk images and assemble the demo programs. `dsk-manager.ts` handles disk-image creation.

### Export

`src/export/` produces CPC-native artifacts: SCR (native screen format), linear, palette, PNG preview, DSK (disk image), SNA (snapshot), and ZIP bundles. `exports/` contains per-format encoders and ASM template generators. Exports for Mode R / EGX / raster have dedicated pipelines (`export-raster-pipeline`, etc.).

### Tauri layer

`src/tauri/` is the only place allowed to touch `@tauri-apps/*`. It wraps file pickers, file I/O, the updater, and quit shortcuts, exposing them so the rest of the app (and the web build) stays platform-agnostic. The Rust side lives in `src-tauri/`.

### i18n

Lingui with catalogs in `src/locales/{de,en,es,fr}`. Wrap user-facing strings with Lingui macros (babel `macros` plugin is configured in `vite.config.ts`). After adding strings, run `i18n:extract` then `i18n:compile`.

### Demo assembly programs

`asm/src/` holds Z80 (RASM) demo programs that display exported images on real/emulated CPC hardware. `pnpm asm:expand` expands `INCLUDE` directives. Each demo has a Makefile; extract a Pixsaur ZIP export into the demo's `data/` folder.
