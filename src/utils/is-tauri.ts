/**
 * Utility function to check if the application is running in a Tauri environment
 *
 * @returns true if running in Tauri, false otherwise
 */
import { logger } from '@/utils/core'

export function isTauri(): boolean {
  // Deprecated: prefer importing `isTauri` from `@/tauri`.
  // This keeps a local implementation for internal use but warns
  // during development so teams move to `@/tauri`.
  if (import.meta.env.DEV) {
    logger.warn(
      "Deprecation: using '@/utils/is-tauri' is deprecated — import from '@/tauri' instead."
    )
  }
  return (
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
  )
}
