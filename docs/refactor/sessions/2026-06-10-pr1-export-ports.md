# Session report — 2026-06-10 — PR1 export ports + kill Tauri leak

## Goal of the session
Introduce the export application-layer port `PlaygroundPort` and remove the lone
production Tauri leak — the dynamic `import('@tauri-apps/plugin-shell')` inside
`src/export/exports/exporters/export-cpc-playground.ts`.

## Done
- Defined `PlaygroundPort` in `src/export/application/ports.ts`
  (`open(url): Promise<void>`).
- Web adapter `src/export/application/adapters/web-playground.ts`
  (`webPlaygroundPort` → `window.open(url, '_blank')`).
- Desktop adapter `src/tauri/playground.ts` (`tauriPlaygroundPort` → lazy
  `@tauri-apps/plugin-shell`), kept inside the sanctioned `src/tauri/` module.
- Runtime seam `src/export/application/playground-port.ts`
  (`resolvePlaygroundPort()` picks web vs desktop via `isTauri()`).
- Rewired `export-cpc-playground.ts`: dropped `isTauri` + the inline
  `isTauri()`/`@tauri-apps` branch in `shareAsmToCpcPlayground`; it now calls
  `resolvePlaygroundPort().open(shareUrl)`. The file no longer references
  `@tauri-apps/*` or `isTauri`.
- Updated the living registry `src/export/application/README.md` (PlaygroundPort
  row → ✅ landed PR1, with adapter symbol names + the resolver seam).
- Verified: no spec changes were needed — the existing
  `export-cpc-playground.spec.ts` mocks (`@/tauri`, `@tauri-apps/plugin-shell`,
  global `open`) still drive both the web and Tauri paths through the new port.

## Not done / remaining
- `FileSink` / `CanvasFactory` ports deliberately NOT defined yet (see Decisions).
- Nothing committed; PR1 still shares the `refactor/pr0-guardrails` branch.
- PR2–PR4 of the export pilot not started.
- Known real duplication still pending: `validate-custom-dimensions.ts`
  duplicated in `src/preview/` and `src/source/`.

## Decisions taken
- Deferred `FileSink` and `CanvasFactory` to PR2 (when the `exportImageToZip` /
  `openImageInPlayground` use-cases consume them). Defining unused port
  interfaces now would regress the knip dead-code ratchet; the strangler-fig
  rule is "introduce a port when a code path consumes it, not before". The
  roadmap's "PR1 = all three ports" was aspirational; the zero-dead-code
  guardrail wins.
- Tauri adapter imported via the deep path `@/tauri/playground` (not the
  `@/tauri` barrel) in the resolver, so the spec's `vi.mock('@/tauri', ...)`
  (which only stubs `isTauri`) doesn't strip `tauriPlaygroundPort`.
- Kept the public `export*ToCpcPlayground` signatures unchanged (resolver called
  inline). Full dependency injection of the port comes with the use-case
  extraction in PR2/PR3.

## Guardrail status
- jscpd: 2.03% dup / 45 clones — no regression vs baseline.
- knip: 25 unused files / 62 unused exports — no regression (all new exports are
  consumed).
- typecheck: pass. Tauri import guard: pass. Tests: 1924 passed / 1 todo / 1
  skipped (full suite). Biome: clean on touched files.

## State to resume from
- Branch: `refactor/pr0-guardrails` · committed? no (PR0 + PR1 both uncommitted
  working-tree changes; PR0 itself was already committed in `a743503`).
- Next action: decide commit/branch strategy for PR1, then start PR2 — extract
  the `exportImageToZip` use-case (`handleExport` in `export-panel.tsx`),
  defining `FileSink` + `CanvasFactory` as it needs them. Use `/extract-use-case`.
- Watch out for: WSL PATH quirk
  (`export PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"`); `pnpm check`
  has a pre-existing unrelated failure (`@radix-ui` import in
  `settings-panel.tsx`); `pnpm test` runs the whole suite (the `-- <path>`
  filter does not narrow it).
