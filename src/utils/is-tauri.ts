/**
 * Utility function to check if the application is running in a Tauri environment
 *
 * @returns true if running in Tauri, false otherwise
 */
export function isTauri(): boolean {
  return (
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
  )
}
