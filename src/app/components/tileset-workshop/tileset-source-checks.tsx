import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  reduceTilesetSheetAtom,
  tilesetSheetInspectionAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import styles from './tileset-workshop.module.css'

/**
 * What the workshop checks in the source before cutting it (M-Q19), as hints
 * of the Grid section (S-Q10): a capture blown up ×N, and one that looks
 * filtered. Nothing while the source passes both.
 */
export function TilesetSourceChecks() {
  const inspection = useAtomValue(tilesetSheetInspectionAtom)
  const reduce = useSetAtom(reduceTilesetSheetAtom)

  if (!inspection?.scale && !inspection?.filtered) return null

  return (
    <section className={styles.suggestions}>
      {inspection.scale && (
        <>
          <output className={styles.note}>
            {/* The factor stays outside the messages: the Lingui macro
                drops the values of an interpolated one here. */}
            <Trans>Image agrandie</Trans>
            {` ×${inspection.scale.factor} `}
            <Trans>détectée.</Trans>
          </output>
          <Button variant='secondary' onClick={() => reduce()}>
            <Trans>Réduire à la taille d'origine</Trans>
          </Button>
        </>
      )}
      {inspection.filtered && (
        <p className={styles.note} role='alert'>
          <Trans>
            L'image porte trop de couleurs : elle semble filtrée ou compressée.
            L'extraction exacte des tuiles peut échouer.
          </Trans>
        </p>
      )}
    </section>
  )
}
