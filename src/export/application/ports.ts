/**
 * Ports for the export feature (clean-archi strangler-fig).
 *
 * A port is an interface for an impure side-effect a use-case needs. Real
 * adapters are injected at the edges (web vs desktop) so the orchestration
 * code stays pure and testable with fakes.
 *
 * Living registry: see `./README.md`.
 */

import type {
  CpcPlaygroundExportResult,
  EgxCpcPlaygroundExportOptions
} from '../exports/exporters/export-cpc-playground'
import type {
  ModeRSnaExportOptions,
  SnaExportOptions
} from '../exports/exporters/export-sna'

/**
 * Opens a CPC Playground share URL in the user's environment.
 *
 * - Web adapter: `./adapters/web-playground.ts` (`window.open`).
 * - Desktop adapter: `@/tauri/playground.ts` (Tauri shell plugin).
 */
export interface PlaygroundPort {
  /** Open the given CPC Playground share URL. */
  open(url: string): Promise<void>
}

/**
 * Persists a produced file (e.g. the export ZIP) to the user's environment.
 *
 * - Web adapter: `./adapters/web-file-sink.ts` (browser download via
 *   `downloadFile`).
 * - Desktop adapter: `@/tauri/file-sink.ts` (native save dialog).
 */
export interface FileSink {
  /**
   * Persist `blob` under `filename`. Resolves `true` when the file was written,
   * `false` when the user cancelled (e.g. dismissed the desktop save dialog).
   */
  save(blob: Blob, filename: string): Promise<boolean>
}

/**
 * Creates an offscreen drawing canvas, so use-cases can build canvas-backed
 * artifacts (PNG export, pixel read-back) without touching `document` directly.
 *
 * - Web & desktop adapter: `./adapters/dom-canvas-factory.ts` (the desktop app
 *   runs in a webview, so the DOM implementation serves both).
 */
export interface CanvasFactory {
  /** Create a canvas sized `width` × `height`. */
  createCanvas(width: number, height: number): HTMLCanvasElement
}

/**
 * Shares a rendered image to CPC Playground (uploads the generated ASM and
 * opens the resulting share URL) for each render mode.
 *
 * Wraps the impure exporters in `../exports/exporters/export-cpc-playground.ts`
 * (network `fetch` + {@link PlaygroundPort} URL open) behind one interface so
 * the `openImageInPlayground` use-case stays pure and testable with a fake.
 *
 * - Web & desktop adapter: `./adapters/cpc-playground-exporter.ts`
 *   (`cpcPlaygroundExporter`); the underlying exporters resolve the
 *   {@link PlaygroundPort} per runtime.
 */
export interface PlaygroundExporter {
  /** Standard (single-frame) export. */
  exportStandard(options: SnaExportOptions): Promise<CpcPlaygroundExportResult>
  /** Mode R (dual-frame interlaced) export. */
  exportModeR(
    options: ModeRSnaExportOptions
  ): Promise<CpcPlaygroundExportResult>
  /** EGX (line-by-line mode alternation) export. */
  exportEgx(
    options: EgxCpcPlaygroundExportOptions
  ): Promise<CpcPlaygroundExportResult>
}
