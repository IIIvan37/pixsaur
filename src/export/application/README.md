# Export — application layer (use-cases + ports)

Living registry for the export feature. **Read this before adding a use-case or
a port** (`/extract-use-case` step 1) so you reuse what exists instead of
duplicating it. Keep it in sync when you land a change.

Target architecture: business orchestration lives in pure async use-cases
`(input, deps) => Promise<Result>`; impure side-effects arrive through ports;
React components / Jotai atoms are thin adapters that assemble the input,
inject the real ports, and map the result to UI.

## Ports

Interfaces in `ports.ts`. Reuse one of these before defining a new port.

| Port | Responsibility | Web adapter | Desktop adapter | Status |
|------|----------------|-------------|-----------------|--------|
| `PlaygroundPort` | open a CPC Playground share URL | `adapters/web-playground.ts` (`webPlaygroundPort`) | `src/tauri/playground.ts` (`tauriPlaygroundPort`) | ✅ landed (PR1) |
| `FileSink` | persist / download the produced file(s) | `adapters/web-file-sink.ts` (`webFileSink` → `downloadFile`) | `src/tauri/file-sink.ts` (`tauriFileSink` → `saveZipFileTauri`) | ✅ landed (PR2) |
| `CanvasFactory` | create a drawing canvas (`createCanvas(w,h)`) | `adapters/dom-canvas-factory.ts` (`domCanvasFactory`) | same DOM adapter (webview) | ✅ landed (PR2) |
| `PlaygroundExporter` | share an image (standard / Mode R / EGX) to CPC Playground | `adapters/cpc-playground-exporter.ts` (`cpcPlaygroundExporter`) | same adapter — wrapped exporters resolve `PlaygroundPort` per runtime | ✅ landed (PR3) |

> `PlaygroundPort` lives in `ports.ts`; the runtime adapter is selected by
> `resolvePlaygroundPort()` in `playground-port.ts` (the impure seam). `FileSink`
> is selected the same way by `resolveFileSink()` in `file-sink.ts`.
> `CanvasFactory` needs no resolver — the DOM implementation serves web and
> desktop (the Tauri app runs in a webview), so `domCanvasFactory` is injected
> directly.

## Use-cases

One row per extracted use-case. Signature is always `(input, deps) => Promise<Result>`.

| Use-case | Replaces | Input (summary) | Result | Ports used |
|----------|----------|-----------------|--------|------------|
| `exportImageToZip` ✅ PR2 | `handleExport` in `components/export-panel/export-panel.tsx` | `{ modeConfig, cpcHardware, config }` + an `egx` **or** `standard` snapshot | `{ ok } \| { ok:false, error }` | `FileSink`, `CanvasFactory` |
| `openImageInPlayground` ✅ PR3 | `handleOpenInPlayground` in the same component | `{ modeConfig, cpcHardware }` + a `modeR` / `egx` / `standard` snapshot (no `ExportConfig`) | `{ ok, mode } \| { ok:false, mode, error }` | `PlaygroundExporter` |

> Status: `exportImageToZip` landed in PR2 — `export-image-to-zip.ts` (+ spec),
> `handleExport` is now a thin adapter, and `exportZip` was split into the pure
> `buildExportZipBlob` (returns the `Blob`; the `FileSink` persists it).
> `openImageInPlayground` landed in PR3 — `open-image-in-playground.ts` (+ spec),
> `handleOpenInPlayground` is now a thin adapter. It does **not** use a canvas
> (it builds ASM straight from index buffers + palettes), so the earlier
> `CanvasFactory` prediction was dropped; the impure upload + URL-open arrive
> through the new `PlaygroundExporter` port. The `Result` carries `mode` so the
> UI keeps its per-mode localized success/error messages.

## Mode branching

Both use-cases branch on render mode: **standard**, **EGX**, **Mode-R**
(`exportImageToZip` covers EGX + standard; `openImageInPlayground` covers all
three). The per-mode steps share palette conversion (+ canvas building in the
ZIP use-case) — factor those into one helper (don't copy-paste per branch;
`pnpm check:dup` watches this).
