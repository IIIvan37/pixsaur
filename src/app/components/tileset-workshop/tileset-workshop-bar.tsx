import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import {
  tilesetLayoutAtom,
  tilesetSheetAtom,
  tilesetSheetNameAtom
} from '@/app/store/tileset/tileset'
import { TilesetExportButtons } from './tileset-export-buttons'
import { TilesetProjectMenu } from './tileset-project-menu'
import { TilesetSettingsButton } from './tileset-settings-dock'
import styles from './tileset-workshop.module.css'

/**
 * The bar over the three columns (S-Q8): what is open on the left — the file,
 * its size, how it is read — and what can be done with it on the right. No
 * brand: the app header carries it, and the Image | Tileset tabs name the
 * workshop.
 */
export function TilesetWorkshopBar() {
  const sheet = useAtomValue(tilesetSheetAtom)
  const name = useAtomValue(tilesetSheetNameAtom)
  const layout = useAtomValue(tilesetLayoutAtom)

  return (
    <div className={styles.bar}>
      <p className={styles.identity}>
        {name && (
          <span className={styles.fileName} title={name}>
            {name}
          </span>
        )}
        {sheet && <span>{`${sheet.width} × ${sheet.height} px`}</span>}
        <span className={styles.layout}>
          {layout === 'map' ? <Trans>Map</Trans> : <Trans>Planche</Trans>}
        </span>
      </p>

      {/* No wrapper: the project messages wrap onto a row of their own. */}
      <TilesetSettingsButton />
      <TilesetProjectMenu />
      <TilesetExportButtons />
    </div>
  )
}
