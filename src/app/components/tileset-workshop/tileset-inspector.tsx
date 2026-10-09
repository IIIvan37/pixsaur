import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import {
  editedTilesetAtom,
  tilesetMapAtom,
  tilesetMapOptionsAtom,
  tilesetSheetAtom
} from '@/app/store/tileset/tileset'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { TilesetEditPanel } from './tileset-edit-panel'
import { TilesetMergeList } from './tileset-merge-list'
import styles from './tileset-workshop.module.css'

/**
 * The right-hand column (S-Q8 · S-Q11): what the conversion made, the tile
 * being retouched, and the merges. One line while no image is open — the
 * settings stay on the left to prepare the grid.
 */
export function TilesetInspector() {
  const { _ } = useLingui()
  const sheet = useAtomValue(tilesetSheetAtom)

  return (
    <section className={styles.inspector} aria-label={_(msg`Inspecteur`)}>
      {sheet ? (
        <>
          <TilesetSummary />
          <TilesetEditPanel />
          <TilesetMergeList />
        </>
      ) : (
        <p className={styles.note}>
          <Trans>Chargez une planche ou une map.</Trans>
        </p>
      )}
    </section>
  )
}

/**
 * The counts the result panel held, as they were; S6 makes one summary of
 * them, read after the retouching (S-Q20).
 */
function TilesetSummary() {
  const { _ } = useLingui()
  const result = useAtomValue(editedTilesetAtom)
  const map = useAtomValue(tilesetMapAtom)
  const { budget } = useAtomValue(tilesetMapOptionsAtom)

  // A failed conversion says why on the stage, in place of the image.
  if (!result?.ok) return null

  const { tileset } = result

  return (
    <Panel>
      <Header title={<Trans>Résultat</Trans>} />

      {/* The numbers stay outside the messages: the Lingui macro drops the
          values of an interpolated one here. */}
      <p>
        <Trans>Tuiles uniques</Trans>
        {' : '}
        <output aria-label={_(msg`Tuiles uniques`)}>
          {`${tileset.unique.length} / ${tileset.tiles.length}`}
        </output>
        {' · '}
        <Trans>Pens</Trans>
        {' : '}
        <output aria-label={_(msg`Pens`)}>{tileset.palette.length}</output>
      </p>

      {map && (
        <p>
          <Trans>Tuiles de la map</Trans>
          {' : '}
          <output aria-label={_(msg`Tuiles de la map`)}>
            {`${map.tiles.length} / ${budget}`}
          </output>
        </p>
      )}
      {map?.overBudget && (
        <p role='alert'>
          <Trans>La map garde plus de tuiles que son budget.</Trans>
        </p>
      )}
    </Panel>
  )
}
