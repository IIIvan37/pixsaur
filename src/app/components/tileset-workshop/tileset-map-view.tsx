import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import {
  renderedTilesetAtlasAtom,
  renderedTilesetMapAtom,
  selectedTileAtom,
  tilesetMapAtom,
  tilesetMapSourceAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TilesetMap } from '@/tileset'
import { cellAt } from './map-cell-at'
import styles from './tileset-workshop.module.css'
import { useSheetCanvas } from './use-sheet-canvas'

/** See-through, so the tile under the mark stays readable. */
const HIGHLIGHT = 'rgba(255, 196, 0, 0.5)'

/**
 * Marks the given cells on a canvas of one pixel per cell. The page stretches
 * it over the map, pixelated, so each pixel covers exactly one cell — however
 * many cells the map has, the mark costs one pixel each.
 */
function useCellMarks(map: TilesetMap | null, cells: readonly number[]) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvas || !map) return

    canvas.width = map.columns
    canvas.height = map.rows
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, map.columns, map.rows)
    context.fillStyle = HIGHLIGHT
    for (const cell of cells) {
      context.fillRect(cell % map.columns, Math.floor(cell / map.columns), 1, 1)
    }
  }, [canvas, map, cells])

  return setCanvas
}

/**
 * The map layout's view of the result (M-Q16): the map rebuilt from its
 * cells, and the tiles it keeps.
 *
 * Hovering a cell marks every cell that shows the same tile — the check that
 * the grid, the deduplication and the budget read the map the way the user
 * does. Comparing puts the source in the result's place, cell for cell.
 */
export function TilesetMapView() {
  const { _ } = useLingui()
  const map = useAtomValue(tilesetMapAtom)
  const result = useAtomValue(renderedTilesetMapAtom)
  const source = useAtomValue(tilesetMapSourceAtom)
  const atlas = useAtomValue(renderedTilesetAtlasAtom)
  const select = useSetAtom(selectedTileAtom)
  const [comparing, setComparing] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  const tile = map && hovered !== null ? map.cells[hovered] : null
  const sharing = useMemo(
    () =>
      map && tile !== null
        ? map.cells.flatMap((shown, cell) => (shown === tile ? [cell] : []))
        : [],
    [map, tile]
  )

  const mapCanvas = useSheetCanvas(comparing ? source : result)
  const atlasCanvas = useSheetCanvas(atlas)
  const marks = useCellMarks(map, sharing)

  if (!map) return null

  const cellUnder = (event: React.MouseEvent<HTMLCanvasElement>) =>
    cellAt(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
      map
    )

  return (
    <Tabs defaultValue='map'>
      <TabsList aria-label={_(msg`Vues de la map`)} className={styles.viewTabs}>
        <TabsTrigger value='map' className={styles.viewTab}>
          <Trans>Map</Trans>
        </TabsTrigger>
        <TabsTrigger value='tileset' className={styles.viewTab}>
          <Trans>Tileset</Trans>
        </TabsTrigger>
      </TabsList>

      <TabsContent value='map'>
        <Button
          variant='secondary'
          aria-pressed={comparing}
          onClick={() => setComparing((was) => !was)}
        >
          <Trans>Comparer avec la source</Trans>
        </Button>

        <div className={styles.mapStage}>
          <canvas
            ref={mapCanvas}
            className={styles.preview}
            role='img'
            aria-label={comparing ? _(msg`Map source`) : _(msg`Map convertie`)}
            onMouseMove={(event) => setHovered(cellUnder(event))}
            onMouseLeave={() => setHovered(null)}
            onClick={(event) => {
              const cell = cellUnder(event)
              if (cell !== null) select(cell)
            }}
          />
          {/* Decoration with no fallback content, so assistive technology
              skips it: what it marks is said in words just below. */}
          <canvas ref={marks} className={styles.mapMarks} />
        </div>

        <p className={styles.note}>
          {tile === null ? (
            <Trans>Survolez une case pour voir où sa tuile revient.</Trans>
          ) : (
            <output aria-label={_(msg`Case survolée`)}>
              {/* The numbers stay outside the messages: the Lingui macro
                  drops the values of an interpolated one here. GID of the
                  tile, as Tiled numbers it. */}
              <Trans>Tuile</Trans>
              {` ${tile + 1} · ${sharing.length} `}
              <Trans>cases</Trans>
            </output>
          )}
        </p>
      </TabsContent>

      <TabsContent value='tileset'>
        <canvas
          ref={atlasCanvas}
          className={styles.preview}
          role='img'
          aria-label={_(msg`Tileset de la map`)}
        />
      </TabsContent>
    </Tabs>
  )
}
