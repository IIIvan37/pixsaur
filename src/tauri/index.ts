// Centralized Tauri helpers module to avoid scattering Tauri-specific code
// across utils and components. This is a safe re-export layer that lets us
// migrate callers progressively.

export { invoke } from '@tauri-apps/api/core'
export { WebviewWindow } from '@tauri-apps/api/webviewWindow'
export { Window } from '@tauri-apps/api/window'
export { open, save } from '@tauri-apps/plugin-dialog'
export { readFile, writeFile } from '@tauri-apps/plugin-fs'
export { relaunch } from '@tauri-apps/plugin-process'
export { check } from '@tauri-apps/plugin-updater'
export * from './export-tauri'
export * from './is-tauri'
export * from './quit-shortcut'
export * from './tauri-file-picker'

// App-level helpers
import { getVersion } from '@tauri-apps/api/app'
import { check } from '@tauri-apps/plugin-updater'
import { isTauri } from './is-tauri'

/**
 * Returns the application version.
 * On web (non-Tauri) mode, fall back to VITE_APP_VERSION.
 */
export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return import.meta.env.VITE_APP_VERSION || ''
  return await getVersion()
}

/**
 * Check for updates using Tauri's updater plugin if available.
 * Returns null in web contexts.
 */
export async function checkForUpdates() {
  if (!isTauri()) return null
  return await check()
}

/**
 * Relaunch the app using Tauri's process plugin.
 */
export async function relaunchApp() {
  if (!isTauri()) return
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}

// If we later add other tauri wrappers (update, process, etc.), we can add
// them here and make components depend on `@/tauri` instead of importing
// the low-level plugins directly.
