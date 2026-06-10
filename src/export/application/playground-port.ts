import { isTauri } from '@/tauri'
import { tauriPlaygroundPort } from '@/tauri/playground'
import { webPlaygroundPort } from './adapters/web-playground'
import type { PlaygroundPort } from './ports'

/**
 * Resolves the {@link PlaygroundPort} for the current runtime (Tauri desktop
 * vs web). This is the impure composition seam: once the export use-cases are
 * extracted (PR2+), they will receive the port as an injected dependency
 * rather than calling this directly.
 */
export function resolvePlaygroundPort(): PlaygroundPort {
  return isTauri() ? tauriPlaygroundPort : webPlaygroundPort
}
