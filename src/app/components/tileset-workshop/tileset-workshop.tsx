/**
 * The tileset workshop (Q6 · Q32 · Q34).
 *
 * Its own panels over its own atom space; it shares the CPC hardware notion
 * and the palette strategies with the image workshop, and nothing else — no
 * rasters, no Mode R, no EGX, no screen dimensions, no crop.
 * See `docs/features/PLAN-tileset-workshop.md`.
 */

import { TilesetEditPanel } from './tileset-edit-panel'
import { TilesetGeometryPanel } from './tileset-geometry-panel'
import { TilesetGridPanel } from './tileset-grid-panel'
import { TilesetPalettePanel } from './tileset-palette-panel'
import { TilesetProjectPanel } from './tileset-project-panel'
import { TilesetRenderPanel } from './tileset-render-panel'
import { TilesetResultPanel } from './tileset-result-panel'
import { TilesetSourcePanel } from './tileset-source-panel'
import styles from './tileset-workshop.module.css'

export default function TilesetWorkshop() {
  return (
    <div className={styles.workshop}>
      <TilesetSourcePanel />
      <TilesetGridPanel />
      <TilesetGeometryPanel />
      <TilesetPalettePanel />
      <TilesetRenderPanel />
      <TilesetResultPanel />
      <TilesetEditPanel />
      <TilesetProjectPanel />
    </div>
  )
}
