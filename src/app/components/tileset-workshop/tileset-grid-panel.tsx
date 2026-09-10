import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  setTilesetGridAtom,
  setTilesetLayoutAtom,
  setTilesetMapOptionsAtom,
  tilesetGridAtom,
  tilesetGridSuggestionsAtom,
  tilesetLayoutAtom,
  tilesetMapOptionsAtom,
  tilesetOffsetSuggestionAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import Input from '@/components/ui/input/input'
import { Header } from '@/components/ui/layout/header/header'
import { ToggleButtonGroup } from '@/components/ui/toggle-button-group'
import type { TilesetLayout } from '@/tileset'
import { TileSuggestions } from './tileset-suggestions'
import styles from './tileset-workshop.module.css'

/** Percentage, no decimals — the ranking is a shortlist, not a measurement. */
const percent = (rate: number) => `${Math.round(rate * 100)} %`

/**
 * Where the tiles sit in the source sheet (Q5 · Q29).
 *
 * The grid stays declared by hand; the ranking only shortlists the tile sizes,
 * on what the tileset each one would cost.
 */
export function TilesetGridPanel() {
  const { _ } = useLingui()
  const grid = useAtomValue(tilesetGridAtom)
  const setGrid = useSetAtom(setTilesetGridAtom)
  const suggestions = useAtomValue(tilesetGridSuggestionsAtom)
  const layout = useAtomValue(tilesetLayoutAtom)
  const setLayout = useSetAtom(setTilesetLayoutAtom)
  const mapOptions = useAtomValue(tilesetMapOptionsAtom)
  const setMapOptions = useSetAtom(setTilesetMapOptionsAtom)
  const offset = useAtomValue(tilesetOffsetSuggestionAtom)

  const number = (key: keyof typeof grid) => ({
    type: 'number',
    min: 0,
    value: String(grid[key] ?? 0),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setGrid({ [key]: Number(event.target.value) })
  })

  return (
    <section className={styles.tab}>
      <Header title={<Trans>Grille source</Trans>} />

      {/* A sheet keeps every tile where it sits; a map keeps each distinct
          tile once and remembers which cell shows it (M-Q1). */}
      <ToggleButtonGroup<TilesetLayout>
        options={[
          { value: 'sheet', label: _(msg`Planche`) },
          { value: 'map', label: _(msg`Map`) }
        ]}
        value={layout}
        onChange={setLayout}
      />

      <div className={styles.fields}>
        <Input
          compact
          label={_(msg`Largeur de tuile`)}
          {...number('tileWidth')}
        />
        <Input
          compact
          label={_(msg`Hauteur de tuile`)}
          {...number('tileHeight')}
        />
        <Input compact label={_(msg`Marge`)} {...number('margin')} />
        <Input compact label={_(msg`Espacement`)} {...number('spacing')} />
        <Input compact label={_(msg`Décalage X`)} {...number('offsetX')} />
        <Input compact label={_(msg`Décalage Y`)} {...number('offsetY')} />
        {layout === 'map' && (
          <Input
            compact
            label={_(msg`Budget de tuiles`)}
            type='number'
            min={1}
            value={String(mapOptions.budget)}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setMapOptions({ budget: Number(event.target.value) })
            }
          />
        )}
      </div>

      {offset && (
        <section className={styles.suggestions}>
          <h2 className={styles.subtitle}>
            <Trans>Décalage suggéré</Trans>
          </h2>
          <p className={styles.note}>
            {`${offset.offsetX}, ${offset.offsetY} — ${offset.uniqueTiles} `}
            <Trans>tuiles uniques</Trans>
          </p>
          <Button
            variant='secondary'
            onClick={() =>
              setGrid({ offsetX: offset.offsetX, offsetY: offset.offsetY })
            }
          >
            <Trans>Appliquer ce décalage</Trans>
          </Button>
        </section>
      )}

      {suggestions.length > 0 && (
        <TileSuggestions
          title={<Trans>Tailles de tuile, la moins coûteuse en tête</Trans>}
          suggestions={suggestions.map((candidate) => ({
            size: {
              tileWidth: candidate.grid.tileWidth,
              tileHeight: candidate.grid.tileHeight
            },
            note: (
              <Trans>
                {candidate.uniqueTiles} tuiles uniques,{' '}
                {percent(candidate.duplicateRate)} de doublons
              </Trans>
            )
          }))}
          onPick={setGrid}
        />
      )}
    </section>
  )
}
