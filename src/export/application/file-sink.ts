import { isTauri } from '@/tauri'
import { tauriFileSink } from '@/tauri/file-sink'
import { webFileSink } from './adapters/web-file-sink'
import type { FileSink } from './ports'

/**
 * Resolves the {@link FileSink} for the current runtime (Tauri desktop vs web).
 * The impure composition seam: use-cases receive the resolved port as an
 * injected dependency rather than calling this directly.
 *
 * The Tauri adapter is imported via the deep path `@/tauri/file-sink` (not the
 * `@/tauri` barrel) so specs that `vi.mock('@/tauri', …)` to stub `isTauri`
 * don't accidentally strip `tauriFileSink`.
 */
export function resolveFileSink(): FileSink {
  return isTauri() ? tauriFileSink : webFileSink
}
