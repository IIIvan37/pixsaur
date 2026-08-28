import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import {
  editedTilesetAtom,
  paintTilesetAtom,
  redoTilesetEditAtom,
  selectedPenAtom,
  selectedTileAtom,
  setTileDitherAtom,
  tilesetEditLayerAtom,
  tilesetOptionsAtom,
  tilesetTargetAtom,
  undoTilesetEditAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input/input'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { Select, SelectItem } from '@/components/ui/select'
import type { Pen, TileDither } from '@/tileset'
import styles from './tileset-workshop.module.css'

const swatch = ([r, g, b]: Pen) => `rgb(${r} ${g} ${b})`

/**
 * Ctrl+Z and Ctrl+Y, the shortcuts the buttons promise. The undo is linear and
 * global (Q31): one step back is one action, whichever tile carried it.
 */
function useUndoShortcuts(undo: () => void, redo: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return

      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) undo()
      else if (key === 'y' || (key === 'z' && event.shiftKey)) redo()
      else return

      event.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])
}

/**
 * The retouching of Q11 · Q19 · Q31.
 *
 * A pen is painted, never a colour: the palette is frozen and an edit is an
 * index into it, which is what lets the sheet be reconverted without losing
 * the work. Painting one tile reaches every instance the deduplication found,
 * and one Ctrl+Z steps back one action wherever it was made.
 *
 * One button per pixel: a 32 x 32 tile is 1024 of them, which the browser
 * takes in its stride and which keeps every pixel reachable at the keyboard.
 */
export function TilesetEditPanel() {
  const { _ } = useLingui()
  const result = useAtomValue(editedTilesetAtom)
  const { tileWidth, tileHeight } = useAtomValue(tilesetTargetAtom)
  const layer = useAtomValue(tilesetEditLayerAtom)
  const options = useAtomValue(tilesetOptionsAtom)
  const setTileDither = useSetAtom(setTileDitherAtom)
  const [selected, setSelected] = useAtom(selectedTileAtom)
  const [pen, setPen] = useAtom(selectedPenAtom)
  const paint = useSetAtom(paintTilesetAtom)
  const undo = useSetAtom(undoTilesetEditAtom)
  const redo = useSetAtom(redoTilesetEditAtom)
  useUndoShortcuts(undo, redo)

  if (!result?.ok) return null

  const { tileset } = result
  // The selection outlives the sheet it was made on; a shorter one clamps it.
  const tile = Math.min(Math.max(selected, 0), tileset.tiles.length - 1)
  const indices = tileset.tiles[tile].indices
  const instances = tileset.instanceOf.filter(
    (of) => of === tileset.instanceOf[tile]
  ).length

  return (
    <Panel>
      <Header title={<Trans>Retouche</Trans>} />

      <div className={styles.fields}>
        <Input
          compact
          label={_(msg`Tuile`)}
          type='number'
          min={0}
          max={tileset.tiles.length - 1}
          value={String(tile)}
          onChange={(event) => setSelected(Number(event.target.value))}
        />

        <div className={styles.field}>
          <span className={styles.label}>
            <Trans>Instances</Trans>
          </span>
          <output className={styles.reading} aria-label={_(msg`Instances`)}>
            {instances}
          </output>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            <Trans>Tramage de la tuile</Trans>
          </span>
          <Select
            aria-label={_(msg`Tramage de la tuile`)}
            value={options.ditherByTile?.[tile] ?? 'sheet'}
            onValueChange={(value) =>
              setTileDither({
                tile,
                dither: value === 'sheet' ? null : (value as TileDither)
              })
            }
          >
            <SelectItem value='sheet'>{_(msg`Comme la planche`)}</SelectItem>
            <SelectItem value='none'>{_(msg`Aucun`)}</SelectItem>
            <SelectItem value='ordered'>{_(msg`Ordonné (Bayer)`)}</SelectItem>
            <SelectItem value='diffusion'>
              {_(msg`Diffusion d'erreur`)}
            </SelectItem>
          </Select>
        </div>
      </div>

      <div className={styles.pens}>
        {tileset.palette.map((colour, index) => (
          <button
            // A pen IS its index: the palette never reorders, and two pens
            // may hold one colour, so nothing else tells them apart.
            // biome-ignore lint/suspicious/noArrayIndexKey: the index is the identity
            key={`pen-${index}`}
            type='button'
            className={styles.pen}
            // The `_` of `@lingui/react` drops the values of an interpolated
            // descriptor, so the number is appended rather than embedded.
            aria-label={`${_(msg`Pen`)} ${index}`}
            aria-pressed={index === pen}
            style={{ background: swatch(colour) }}
            onClick={() => setPen(index)}
          />
        ))}
      </div>

      {/* A 32 px tile is 32 rem of buttons — wider than the column it sits in
          on a laptop, so the grid scrolls rather than pushing the layout. */}
      <div className={styles.tileScroll}>
        <div
          className={styles.tile}
          style={{ gridTemplateColumns: `repeat(${tileWidth}, 1fr)` }}
        >
          {Array.from({ length: tileWidth * tileHeight }, (_unused, at) => {
            const x = at % tileWidth
            const y = Math.floor(at / tileWidth)
            return (
              <button
                key={`pixel-${x}-${y}`}
                type='button'
                className={styles.pixel}
                aria-label={`${_(msg`Pixel`)} ${x}, ${y}`}
                style={{ background: swatch(tileset.palette[indices[at]]) }}
                onClick={() => paint({ tile, pixels: [{ x, y }], pen })}
              />
            )
          })}
        </div>
      </div>

      <div className={styles.buttons}>
        <Button disabled={layer.at < 0} onClick={() => undo()}>
          <Trans>Annuler (Ctrl+Z)</Trans>
        </Button>
        <Button
          disabled={layer.at >= layer.strokes.length - 1}
          onClick={() => redo()}
        >
          <Trans>Refaire (Ctrl+Y)</Trans>
        </Button>
      </div>

      <p className={styles.note}>
        <Trans>
          On peint un pen, jamais une couleur : les retouches sont rejouées
          après chaque conversion et atteignent toutes les instances de la
          tuile.
        </Trans>
      </p>
    </Panel>
  )
}
