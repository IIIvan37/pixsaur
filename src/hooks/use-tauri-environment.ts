/**
 * Hook to detect if the app is running in Tauri (desktop) or browser (web)
 */
export function useTauriEnvironment() {
  // Check if we're running in Tauri by checking for the __TAURI_INTERNALS__ global
  const isTauri =
    typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis

  return {
    isTauri,
    isWeb: !isTauri
  }
}
