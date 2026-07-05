import { invoke } from '@tauri-apps/api/core'
import type { LogSink } from '@/core'

/**
 * Tauri adapter for the core `LogSink` port: forwards a formatted log line to
 * the Rust backend (`log_to_file` command). Registered at startup by
 * `src/app/app.tsx` only when running under Tauri, so the pure core stays free
 * of any `@/tauri` / `@tauri-apps/*` dependency.
 */
export const tauriLogSink: LogSink = (_level, message) =>
  invoke('log_to_file', { message })
