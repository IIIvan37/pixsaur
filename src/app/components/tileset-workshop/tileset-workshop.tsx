/**
 * The tileset workshop (Q6 · Q32 · Q34).
 *
 * Its own panels over its own atom space; it shares the CPC hardware notion
 * and the palette strategies with the image workshop, and nothing else — no
 * rasters, no Mode R, no EGX, no screen dimensions, no crop.
 * See `docs/features/PLAN-tileset-workshop.md`.
 */

import { TilesetSourcePanel } from './tileset-source-panel'

export default function TilesetWorkshop() {
  return <TilesetSourcePanel />
}
