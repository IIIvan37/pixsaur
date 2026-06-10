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
| `FileSink` | persist / download the produced file(s) | `@/export/download-file` | Tauri save dialog (`src/tauri/`) | ⬜ planned (PR2) |
| `CanvasFactory` | create a drawing canvas (`createCanvas(w,h)`) | DOM `document.createElement` | DOM (webview) | ⬜ planned (PR2) |

> `PlaygroundPort` lives in `ports.ts`; the runtime adapter is selected by
> `resolvePlaygroundPort()` in `playground-port.ts` (the impure seam). `FileSink`
> and `CanvasFactory` land with the use-cases that need them (PR2+) to keep the
> dead-code ratchet at zero — define a port when a code path consumes it, not
> before.

## Use-cases

One row per extracted use-case. Signature is always `(input, deps) => Promise<Result>`.

| Use-case | Replaces | Input (summary) | Result | Ports used |
|----------|----------|-----------------|--------|------------|
| `exportImageToZip` | `handleExport` in `components/export-panel/export-panel.tsx` | index buffer + palette + mode/hardware + raster + EGX/Mode-R data + `ExportConfig` | `{ ok } \| { ok:false, error }` | `FileSink`, `CanvasFactory` |
| `openImageInPlayground` | `handleOpenInPlayground` in the same component | same snapshot (no `ExportConfig`) | `{ ok } \| { ok:false, error }` | `PlaygroundPort`, `CanvasFactory` |

> Status: planned. Mark each row "landed (PRn)" when the use-case + its
> tests exist and the old handler path is deleted.

## Mode branching

Both use-cases branch on render mode: **standard**, **EGX**, **Mode-R**. The
per-mode steps share palette conversion + canvas building — factor those into
one helper (don't copy-paste per branch; `pnpm check:dup` watches this).
