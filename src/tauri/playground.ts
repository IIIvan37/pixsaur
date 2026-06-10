import type { PlaygroundPort } from '@/export/application/ports'

/**
 * Desktop adapter for {@link PlaygroundPort}: opens the share URL via the
 * Tauri shell plugin. Lives under `src/tauri/` so the rest of the app never
 * touches `@tauri-apps/*` directly (the plugin is loaded lazily).
 */
export const tauriPlaygroundPort: PlaygroundPort = {
  async open(url) {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  }
}
