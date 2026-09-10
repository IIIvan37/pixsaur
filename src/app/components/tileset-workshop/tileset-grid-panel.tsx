import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  setTilesetGridAtom,
  tilesetGridAtom,
  tilesetGridSuggestionsAtom
} from '@/app/store/tileset/tileset'
import Input from '@/components/ui/input/input'
import { Header } from '@/components/ui/layout/header/header'
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
      </div>

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
