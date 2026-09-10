/**
 * The tileset workshop (Q6 · Q32 · Q34).
 *
 * Its own panels over its own atom space; it shares the CPC hardware notion
 * and the palette strategies with the image workshop, and nothing else — no
 * rasters, no Mode R, no EGX, no screen dimensions, no crop.
 * See `docs/features/PLAN-tileset-workshop.md`.
 *
 * The layout is the image workshop's, deliberately: one card over the CRT
 * veil, an action bar of rare actions and a live readout, then the workspace —
 * the settings docked on the left, the sheet and the result in two columns
 * that grow. Settings never share the flow with what they act on, which is
 * what made the panels look thrown about when they all wrapped together.
 */

import { TilesetEditPanel } from './tileset-edit-panel'
import { TilesetInfoBar } from './tileset-info-bar'
import { TilesetProjectActions } from './tileset-project-actions'
import { TilesetResultPanel } from './tileset-result-panel'
import {
  TilesetSettingsButton,
  TilesetSettingsDock
} from './tileset-settings-dock'
import { TilesetSourcePanel } from './tileset-source-panel'
import styles from './tileset-workshop.module.css'

export default function TilesetWorkshop() {
  return (
    <div className={styles.workshop}>
      <div className={styles.card}>
        <div className={styles.actions}>
          <TilesetSettingsButton />
          <TilesetProjectActions />
          <TilesetInfoBar />
        </div>

        <div className={styles.workspace}>
          <TilesetSettingsDock />

          <div className={styles.column}>
            <TilesetSourcePanel />
          </div>

          <div className={styles.column}>
            <TilesetResultPanel />
            <TilesetEditPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
