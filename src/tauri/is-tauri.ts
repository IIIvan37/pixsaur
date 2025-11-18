/**
 * Check if running inside Tauri runtime.
 * Moved from `src/utils/is-tauri.ts` into the `tauri` domain entrypoint.
 */
import { logger } from '@/core'

export function isTauri(): boolean {
  if (import.meta.env.DEV) {
    logger.warn(
      "Deprecation: using '@/utils/is-tauri' is deprecated — import from '@/tauri' instead."
    )
  }
  return (
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
  )
}

export default isTauri
