/**
 * Utility function to check if the application is running in a Tauri environment
 *
 * @returns true if running in Tauri, false otherwise
 */
import { logger } from '@/core'
import { isTauri as isTauriDomain } from '@/tauri'

export function isTauri(): boolean {
  if (import.meta.env.DEV) {
    logger.warn(
      "Deprecation: using '@/utils/is-tauri' is deprecated — import from '@/tauri' instead."
    )
  }
  return isTauriDomain()
}
