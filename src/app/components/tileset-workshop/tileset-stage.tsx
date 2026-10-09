import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import {
  editedTilesetAtom,
  renderedTilesetSheetAtom,
  setTilesetSheetAtom,
  tilesetMapAtom,
  tilesetSheetAtom
} from '@/app/store/tileset/tileset'
import { ImageUpload } from '@/components/image-upload/image-upload'
import { sheetFromImage } from './sheet-from-image'
import { TilesetMapView } from './tileset-map-view'
import styles from './tileset-workshop.module.css'
import { useSheetCanvas } from './use-sheet-canvas'

const FAILURES = {
  'grid-mismatch': msg`Aucune tuile entière n'entre dans la grille déclarée.`,
  'no-pens-left': msg`La réservation ne laisse aucun pen au tileset.`,
  'palette-too-wide': msg`La palette gelée dépasse ce que le mode peut tenir.`,
  'palette-missing-hole': msg`La palette gelée ne commence pas par le pen de transparence.`,
  'locked-pen-out-of-range': msg`Un pen épinglé n'a pas de place dans ce mode.`
}

/**
 * The centre of the workshop (S-Q8 · S-Q10): the drop zone while no image is
 * open, then what the conversion made of it — the map, or the converted
 * sheet. The zoom and the views come with S3 and S4.
 */
export function TilesetStage() {
  const { _ } = useLingui()
  const sheet = useAtomValue(tilesetSheetAtom)
  const setSheet = useSetAtom(setTilesetSheetAtom)

  // The file name rides along: the workshop bar shows it (S-Q8).
  const handleLoaded = useCallback(
    (img: HTMLImageElement, file: File) =>
      setSheet(sheetFromImage(img), file.name),
    [setSheet]
  )

  return (
    <section className={styles.stage} aria-label={_(msg`Scène`)}>
      {sheet ? (
        <TilesetStageView />
      ) : (
        <div className={styles.dropZone}>
          <ImageUpload onImageLoaded={handleLoaded} />
        </div>
      )}
    </section>
  )
}

function TilesetStageView() {
  const { _ } = useLingui()
  const result = useAtomValue(editedTilesetAtom)
  const rendered = useAtomValue(renderedTilesetSheetAtom)
  const map = useAtomValue(tilesetMapAtom)
  const canvas = useSheetCanvas(rendered)

  if (!result) return null

  if (!result.ok) {
    return <p role='alert'>{_(FAILURES[result.error])}</p>
  }

  if (map) return <TilesetMapView />

  return (
    rendered && (
      <canvas
        ref={canvas}
        className={styles.preview}
        role='img'
        aria-label={_(msg`Planche convertie`)}
      />
    )
  )
}
