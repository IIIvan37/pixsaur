import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { convertedTilesetAtom } from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { logger } from '@/core'
import { resolveFileSink } from '@/export/application/file-sink'
import type { ConvertTilesetResult } from '@/tileset'
import styles from './tileset-workshop.module.css'

/** How many collisions are worth reading before the list stops informing. */
const WORST_SHOWN = 8

const FAILURES = {
  'grid-mismatch': msg`Aucune tuile entière n'entre dans la grille déclarée.`,
  'no-pens-left': msg`La réservation ne laisse aucun pen au tileset.`,
  'palette-too-wide': msg`La palette gelée dépasse ce que le mode peut tenir.`,
  'palette-missing-hole': msg`La palette gelée ne commence pas par le pen de transparence.`
}

/** Blob URL of the PNG, released as soon as another conversion replaces it. */
function usePngUrl(result: ConvertTilesetResult | null) {
  const png = result?.ok ? result.png : null
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!png) {
      setUrl(null)
      return
    }

    const blob = new Blob([png as BlobPart], { type: 'image/png' })
    const created = URL.createObjectURL(blob)
    setUrl(created)
    return () => URL.revokeObjectURL(created)
  }, [png])

  return url
}

/**
 * What the conversion produced: the sheet itself, and the tiles the shared
 * palette pushed furthest from the colours they asked for (Q20 · Q22).
 *
 * The collision report is what directs the manual retouching, and the whole
 * tool rests on it: a NES sheet carries ~25 colours, a mode 0 offers 16.
 */
export function TilesetResultPanel() {
  const { _ } = useLingui()
  const result = useAtomValue(convertedTilesetAtom)
  const url = usePngUrl(result)

  if (!result) return null

  if (!result.ok) {
    return (
      <Panel>
        <Header title={<Trans>Résultat</Trans>} />
        <p role='alert'>{_(FAILURES[result.error])}</p>
      </Panel>
    )
  }

  const { tileset, png } = result
  // A tile that lost nothing is not a collision, however it ranks.
  const worst = tileset.collisions
    .filter((collision) => collision.error > 0)
    .slice(0, WORST_SHOWN)

  return (
    <Panel>
      <Header title={<Trans>Résultat</Trans>} />

      {url && (
        <img
          className={styles.preview}
          src={url}
          alt={_(msg`Planche convertie`)}
        />
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

      <Button
        onClick={() =>
          resolveFileSink()
            .save(
              new Blob([png as BlobPart], { type: 'image/png' }),
              'tileset.png'
            )
            .catch((error) =>
              logger.error('[TILESET] Failed to save the sheet:', error)
            )
        }
      >
        <Trans>Enregistrer le PNG</Trans>
      </Button>

      <section className={styles.suggestions}>
        <h2 className={styles.subtitle}>
          <Trans>Tuiles les plus malmenées par la palette</Trans>
        </h2>
        {worst.length === 0 ? (
          <p className={styles.note}>
            <Trans>Aucune tuile ne perd de couleur.</Trans>
          </p>
        ) : (
          <ul className={styles.candidates}>
            {worst.map((collision) => (
              <li key={collision.tile}>
                <Trans>Tuile {collision.tile}</Trans>
                {` — ${collision.error.toFixed(1)}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  )
}
