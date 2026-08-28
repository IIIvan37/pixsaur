import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  convertedTilesetAtom,
  setTilesetOptionsAtom,
  tilesetOptionsAtom
} from '@/app/store/tileset/tileset'
import Checkbox from '@/components/ui/checkbox/checkbox'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { Select, SelectItem } from '@/components/ui/select'
import type { BayerSize } from '@/libs/pixsaur-tileset'
import type { TileDither } from '@/tileset'
import styles from './tileset-workshop.module.css'

const BAYER_SIZES: BayerSize[] = [2, 4, 8]

/**
 * How a colour the palette has not got is said with the pens it has, and how
 * the tiles are shrunk to size (Q12 · Q17 · Q18).
 *
 * Anti-aliasing and dithering never touch the same pixel: contours belong to
 * one, flats to the other (Q27).
 */
export function TilesetRenderPanel() {
  const { _ } = useLingui()
  const options = useAtomValue(tilesetOptionsAtom)
  const setOptions = useSetAtom(setTilesetOptionsAtom)
  const converted = useAtomValue(convertedTilesetAtom)
  const search = converted?.ok ? converted.tileset.resizeSearch : null

  return (
    <Panel>
      <Header title={<Trans>Rendu</Trans>} />

      <div className={styles.fields}>
        <span className={styles.label}>
          <Trans>Réduction</Trans>
        </span>
        <Select
          aria-label={_(msg`Réduction`)}
          value={options.resize ?? 'columns'}
          onValueChange={(value) =>
            setOptions({ resize: value as 'columns' | 'nearest' })
          }
        >
          <SelectItem value='columns'>
            {_(msg`Colonnes choisies une à une`)}
          </SelectItem>
          <SelectItem value='nearest'>{_(msg`Plus proche voisin`)}</SelectItem>
        </Select>

        <span className={styles.label}>
          <Trans>Tramage</Trans>
        </span>
        <Select
          aria-label={_(msg`Tramage`)}
          value={options.dither ?? 'none'}
          onValueChange={(value) => setOptions({ dither: value as TileDither })}
        >
          <SelectItem value='none'>{_(msg`Aucun`)}</SelectItem>
          <SelectItem value='ordered'>{_(msg`Ordonné (Bayer)`)}</SelectItem>
          <SelectItem value='diffusion'>
            {_(msg`Diffusion d'erreur`)}
          </SelectItem>
        </Select>

        <span className={styles.label}>
          <Trans>Matrice de Bayer</Trans>
        </span>
        <Select
          aria-label={_(msg`Matrice de Bayer`)}
          value={String(options.ditherSize ?? 4)}
          onValueChange={(value) =>
            setOptions({ ditherSize: Number(value) as BayerSize })
          }
          disabled={options.dither !== 'ordered'}
        >
          {BAYER_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {`${size} x ${size}`}
            </SelectItem>
          ))}
        </Select>
      </div>

      <Checkbox
        label={_(msg`Adoucir les escaliers`)}
        checked={options.antiAlias ?? true}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setOptions({ antiAlias: event.target.checked })
        }
      />

      {search && (
        <p className={styles.note}>
          {search.columns === 'greedy' || search.rows === 'greedy' ? (
            <Trans>
              Recherche approchée : la planche dépasse le budget exhaustif, les
              lignes ont été retirées une à une.
            </Trans>
          ) : (
            <Trans>
              Recherche exhaustive : toutes les combinaisons de lignes ont été
              évaluées.
            </Trans>
          )}
        </p>
      )}
    </Panel>
  )
}
