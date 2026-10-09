import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  editedTilesetAtom,
  paintTilesetAtom,
  selectedPenAtom,
  selectedTileAtom,
  tilesetLayoutAtom,
  tilesetTargetAtom
} from '@/app/store/tileset/tileset'
import Input from '@/components/ui/input/input'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import type { Pen } from '@/tileset'
import styles from './tileset-workshop.module.css'

const swatch = ([r, g, b]: Pen) => `rgb(${r} ${g} ${b})`

/**
 * The retouching of Q11 · Q19.
 *
 * A pen is painted, never a colour: the palette is frozen and an edit is an
 * index into it, which is what lets the sheet be reconverted without losing
 * the work. Painting one tile reaches every instance the deduplication found.
 *
 * One button per pixel: a 32 x 32 tile is 1024 of them, which the browser
 * takes in its stride and which keeps every pixel reachable at the keyboard.
 */
export function TilesetEditPanel() {
  const { _ } = useLingui()
  const result = useAtomValue(editedTilesetAtom)
  const { tileWidth, tileHeight } = useAtomValue(tilesetTargetAtom)
  const [selected, setSelected] = useAtom(selectedTileAtom)
  const [pen, setPen] = useAtom(selectedPenAtom)
  const paint = useSetAtom(paintTilesetAtom)
  const layout = useAtomValue(tilesetLayoutAtom)

  if (!result?.ok) return null

  const { tileset } = result
  // The selection outlives the grid it was made on; a shorter one clamps it.
  const tile =
    selected === null
      ? null
      : Math.min(Math.max(selected, 0), tileset.tiles.length - 1)

  const numberField = (
    <Input
      compact
      label={_(msg`Tuile`)}
      type='number'
      min={0}
      max={tileset.tiles.length - 1}
      value={tile === null ? '' : String(tile)}
      onChange={(event) =>
        setSelected(
          event.target.value === '' ? null : Number(event.target.value)
        )
      }
    />
  )

  // S-Q11: nothing picked yet, so the panel says how to pick. Only the map
  // takes a click for now; the sheet does from S7 on.
  if (tile === null) {
    return (
      <Panel>
        <Header title={<Trans>Retouche</Trans>} />
        <p className={styles.note}>
          {layout === 'map' ? (
            <Trans>
              Cliquez une case de la map pour choisir la tuile à retoucher.
            </Trans>
          ) : (
            <Trans>Donnez le numéro de la tuile à retoucher.</Trans>
          )}
        </p>
        <div className={styles.fields}>{numberField}</div>
      </Panel>
    )
  }

  const indices = tileset.tiles[tile].indices
  const instances = tileset.instanceOf.filter(
    (of) => of === tileset.instanceOf[tile]
  ).length

  return (
    <Panel>
      <Header title={<Trans>Retouche</Trans>} />

      <div className={styles.fields}>
        {numberField}

        <div className={styles.field}>
          <span className={styles.label}>
            <Trans>Instances</Trans>
          </span>
          <output className={styles.reading} aria-label={_(msg`Instances`)}>
            {instances}
          </output>
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
