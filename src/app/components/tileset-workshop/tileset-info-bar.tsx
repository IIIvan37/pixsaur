/**
 * The live readout of the action bar — what the current settings produced.
 *
 * Same role as the image workshop's `InfoBar`: the three numbers that say
 * whether the conversion is going well, kept out of the panels so they are
 * legible without opening anything.
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { editedTilesetAtom, tilesetModeAtom } from '@/app/store/tileset/tileset'
import styles from './tileset-workshop.module.css'

export function TilesetInfoBar() {
  const { _ } = useLingui()
  const mode = useAtomValue(tilesetModeAtom)
  const result = useAtomValue(editedTilesetAtom)
  const tileset = result?.ok ? result.tileset : null

  return (
    <div className={styles.infoBar}>
      <span className={styles.infoItem}>
        <span className={styles.infoLabel}>
          <Trans>Mode</Trans>
        </span>
        <output className={styles.infoValue} aria-label={_(msg`Mode`)}>
          {mode}
        </output>
      </span>

      <span className={styles.infoItem}>
        <span className={styles.infoLabel}>
          <Trans>Tuiles uniques</Trans>
        </span>
        {/* The numbers stay outside the message: the Lingui macro drops the
            values of an interpolated one here. */}
        <output
          className={styles.infoValue}
          aria-label={_(msg`Tuiles uniques`)}
        >
          {tileset ? `${tileset.unique.length} / ${tileset.tiles.length}` : '—'}
        </output>
      </span>

      <span className={styles.infoItem}>
        <span className={styles.infoLabel}>
          <Trans>Pens</Trans>
        </span>
        <output className={styles.infoValue} aria-label={_(msg`Pens`)}>
          {tileset ? tileset.palette.length : '—'}
        </output>
      </span>
    </div>
  )
}
