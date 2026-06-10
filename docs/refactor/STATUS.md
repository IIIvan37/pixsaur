# Refactor — STATUS (canonical resume point)

**Read this first when resuming in a new session.** It always reflects the
current state. History lives in `docs/refactor/sessions/` (append-only).

Effort: incremental strangler-fig toward **use-cases + light ports** (NOT a
rewrite). Jotai/React become thin adapters over pure use-cases. Rationale &
big picture: `src/export/application/README.md` and the memory note
`refactor-clean-archi-plan`.

## Where we are

- **Branch:** `refactor/pr0-guardrails`
- **Current step:** PR0 (guardrails) — DONE, awaiting commit decision.
- **Next step:** PR1 — define export ports + remove the lone Tauri leak
  (`src/export/exports/exporters/export-cpc-playground.ts`).

## Roadmap

Pilot feature = **Export** (`src/export`). Pattern proven here is replayed on
quantize, then the preview pipeline.

| PR | Scope | Status |
|----|-------|--------|
| PR0 | Guardrails: knip + jscpd (report-only), skills, registry, this doc | ✅ done (uncommitted) |
| PR1 | Export ports (`PlaygroundPort`/`FileSink`/`CanvasFactory`) + kill Tauri leak | ⬜ todo |
| PR2 | `exportImageToZip` use-case (extract `handleExport`) + tests | ⬜ todo |
| PR3 | `openImageInPlayground` use-case (extract `handleOpenInPlayground`) + tests | ⬜ todo |
| PR4 | `useExportActions` hook → `export-panel.tsx` becomes thin UI | ⬜ todo |
| — | Then: quantize feature, then preview pipeline | ⬜ later |

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
