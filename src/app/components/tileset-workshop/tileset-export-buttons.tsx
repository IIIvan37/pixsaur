import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useCallback } from 'react'
import {
  editedTilesetAtom,
  renderedTilesetSheetAtom,
  tilesetConversionInputAtom,
  tilesetMapAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import { logger } from '@/core'
import { domCanvasFactory } from '@/export/application/adapters/dom-canvas-factory'
import { resolveFileSink } from '@/export/application/file-sink'
import { exportTilesetTiled, saveTilesetSheet } from '@/tileset'

/**
 * The two ways out of the workshop (Q20 · S-Q8), at the right of its bar: the
 * PNG as a secondary action, the Tiled export as the one the work leads to.
 */
export function TilesetExportButtons() {
  const result = useAtomValue(editedTilesetAtom)
  const sheet = useAtomValue(renderedTilesetSheetAtom)
  const input = useAtomValue(tilesetConversionInputAtom)
  const map = useAtomValue(tilesetMapAtom)

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

  return (
    <>
      <Button
        variant='secondary'
        disabled={!sheet}
        onClick={() => void handleSave()}
      >
        <Trans>Enregistrer le PNG</Trans>
      </Button>
      <Button
        disabled={!result?.ok || !input}
        onClick={() => void handleExportTiled()}
      >
        <Trans>Exporter pour Tiled</Trans>
      </Button>
    </>
  )
}
