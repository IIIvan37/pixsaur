/**
 * Ports for the tileset workshop (clean-archi strangler-fig).
 *
 * A port is an interface for an impure side-effect a use-case needs. Real
 * adapters are injected at the edges so the orchestration stays pure and
 * testable with fakes.
 */

import type { TilesetProject } from './tileset-project'

/**
 * Where the workshop's document sleeps between two visits (Q31).
 *
 * - Browser adapter: `./adapters/idb-project-store.ts` (IndexedDB — the sheet
 *   is far past what `localStorage` holds, and the session mechanism's
 *   anti-quota fallback drops the image).
 */
export interface TilesetProjectStore {
  /**
   * What was last saved, or `null`. Unvalidated on purpose: it may have been
   * written by another version — `readStoredTilesetProject` is the judge.
   */
  load(): Promise<unknown>
  save(project: TilesetProject): Promise<void>
  clear(): Promise<void>
}
