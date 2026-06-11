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
| `openImageInPlayground` | `handleOpenInPlayground` in the same component | same snapshot (no `ExportConfig`) | `{ ok } \| { ok:false, error }` | `PlaygroundPort`, `CanvasFactory` |

> Status: `exportImageToZip` landed in PR2 — `export-image-to-zip.ts` (+ spec),
> `handleExport` is now a thin adapter, and `exportZip` was split into the pure
> `buildExportZipBlob` (returns the `Blob`; the `FileSink` persists it).
> `openImageInPlayground` is still planned (PR3). Mark each row "landed (PRn)"
> when the use-case + its tests exist and the old handler path is deleted.

## Mode branching

Both use-cases branch on render mode: **standard**, **EGX**, **Mode-R**. The
per-mode steps share palette conversion + canvas building — factor those into
one helper (don't copy-paste per branch; `pnpm check:dup` watches this).
