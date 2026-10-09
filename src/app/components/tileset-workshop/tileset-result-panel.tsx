import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import {
  editedTilesetAtom,
  renderedTilesetSheetAtom,
  tilesetConversionInputAtom,
  tilesetMapAtom,
  tilesetMapOptionsAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { logger } from '@/core'
import { domCanvasFactory } from '@/export/application/adapters/dom-canvas-factory'
import { resolveFileSink } from '@/export/application/file-sink'
import { exportTilesetTiled, saveTilesetSheet } from '@/tileset'
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

/** What the conversion produced: the sheet itself, and how to save it (Q20). */
export function TilesetResultPanel() {
  const { _ } = useLingui()
  const result = useAtomValue(editedTilesetAtom)
  const sheet = useAtomValue(renderedTilesetSheetAtom)
  const input = useAtomValue(tilesetConversionInputAtom)
  const map = useAtomValue(tilesetMapAtom)
  const { budget } = useAtomValue(tilesetMapOptionsAtom)
  const canvas = useSheetCanvas(sheet)

  const handleSave = useCallback(async () => {
    if (!sheet) return

    const saved = await saveTilesetSheet(
      { sheet },
      { canvasFactory: domCanvasFactory, fileSink: resolveFileSink() }
    )
    if (!saved.ok) {
      logger.error('[TILESET] Failed to save the sheet:', saved.error)
    }
  }, [sheet])

  const handleExportTiled = useCallback(async () => {
    if (!result?.ok || !input) return

    const exported = await exportTilesetTiled(
      { ...input, tileset: result.tileset, map: map ?? undefined },
      { canvasFactory: domCanvasFactory, fileSink: resolveFileSink() }
    )
    if (!exported.ok) {
      logger.error('[TILESET] Failed to export for Tiled:', exported.error)
    }
  }, [result, input, map])

  if (!result) return null

  if (!result.ok) {
    return (
      <Panel>
        <Header title={<Trans>Résultat</Trans>} />
        <p role='alert'>{_(FAILURES[result.error])}</p>
      </Panel>
    )
  }

  const { tileset } = result

  return (
    <Panel>
      <Header title={<Trans>Résultat</Trans>} />

      {map ? (
        <TilesetMapView />
      ) : (
        sheet && (
          <canvas
            ref={canvas}
            className={styles.preview}
            role='img'
            aria-label={_(msg`Planche convertie`)}
          />
        )
      )}

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

      <div className={styles.buttons}>
        <Button disabled={!sheet} onClick={() => void handleSave()}>
          <Trans>Enregistrer le PNG</Trans>
        </Button>
        <Button onClick={() => void handleExportTiled()}>
          <Trans>Exporter pour Tiled</Trans>
        </Button>
      </div>
    </Panel>
  )
}
