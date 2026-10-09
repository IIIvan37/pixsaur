/**
 * The tileset workshop (Q6 · Q32 · Q34), laid out around a stage (S-Q8).
 *
 * Its own panels over its own atom space; it shares the CPC hardware notion
 * and the palette strategies with the image workshop, and nothing else — no
 * rasters, no Mode R, no EGX, no screen dimensions, no crop.
 * See `docs/features/PLAN-tileset-workshop.md` and
 * `docs/features/PLAN-tileset-stage.md`.
 *
 * One card over the CRT veil, the height of the window: a bar of what is open
 * and what can be done with it, then three columns — the settings on the
 * left, the stage in the middle, the inspector on the right — each scrolling
 * on its own. Below 860 px they stack and the page scrolls.
 */

import { useAtomValue } from 'jotai'
import { tilesetSettingsOpenAtom } from '@/app/store/tileset/tileset'
import { TilesetInspector } from './tileset-inspector'
import { TilesetSettingsDock } from './tileset-settings-dock'
import { TilesetStage } from './tileset-stage'
import styles from './tileset-workshop.module.css'
import { TilesetWorkshopBar } from './tileset-workshop-bar'
import { useFillWindow } from './use-fill-window'

export default function TilesetWorkshop() {
  const settingsOpen = useAtomValue(tilesetSettingsOpenAtom)
  const fillWindow = useFillWindow()

  return (
    <div className={styles.workshop}>
      <div ref={fillWindow} className={styles.card}>
        <TilesetWorkshopBar />

        <div
          className={styles.workspace}
          data-settings={settingsOpen ? 'open' : 'closed'}
        >
          {settingsOpen && (
            <div className={styles.settings}>
              <TilesetSettingsDock />
            </div>
          )}
          <TilesetStage />
          <TilesetInspector />
        </div>
      </div>
    </div>
  )
}
